import { isAbsolute, relative, resolve, sep } from "node:path";
import { estimateTokens } from "../core/context.js";
import { statsReport } from "../core/stats.js";
import { DATA_DIR_NAME } from "../core/workspace.js";
import { sessionContext } from "./session-context.js";
import { SessionCache } from "./session-cache.js";
import { conversationSize, transcriptTurns } from "./transcript.js";
import type { HookSettings } from "./settings.js";
import type { ActiveThread, Services, ThreadNode } from "../types/index.js";

/** Events the Claude Code hooks report to the server through threadmind_hook. */
export const HOOK_EVENTS = [
  "session-start",
  "stop",
  "pre-compact",
  "user-prompt",
  "file-edited",
  "branch-check",
] as const;
export type HookEvent = (typeof HOOK_EVENTS)[number];

/** The hook input fields the plugin passes to threadmind_hook. */
export interface HookCall {
  event: HookEvent;
  session_id?: string;
  transcript_path?: string;
  /** SessionStart: startup, resume, clear, compact or fork */
  source?: string;
  /** PreCompact: manual or auto */
  trigger?: string;
  /** Stop: true when Claude is already continuing because of a stop hook */
  stop_hook_active?: boolean | string;
  /** UserPromptSubmit: the prompt as typed */
  prompt?: string;
  /** PostToolUse on Edit or Write: the edited file */
  file_path?: string;
}

/** A hook's output, in Claude Code's JSON hook output format. */
export type HookOutput = Record<string, unknown>;

/** Unsaved work below this size isn't worth interrupting for. */
const MIN_UNSAVED = 10_000;
/** Context window assumed when nothing tells its size. */
const DEFAULT_WINDOW = 200_000;
const LARGE_WINDOW = 1_000_000;
/** Recently edited files remembered per thread. */
const MAX_TOUCHED = 30;

/** Shortcuts answered without involving Claude. */
const INSTANT_COMMAND = /^(?:tm:|\/thread-mind:)(tree|stats)$/i;

/** How much work a session did since the active thread's summary was saved. */
interface Watch {
  sessionId: string;
  threadKey: string;
  projectId: string;
  threadId: string;
  /** The thread's updatedAt when counting started */
  savedAt: string;
  /** Last conversation size seen, in tokens */
  lastSize: number;
  /** Conversation growth since the summary was last saved */
  unsaved: number;
  /** `unsaved` when the last reminder was sent */
  remindedAt: number | null;
  /** Whether the nearly-full-context reminder was sent */
  urgentSent: boolean;
  /** A compaction happened while work was unsaved */
  compactPending: boolean;
}

/**
 * Keeps ThreadMind on track during a Claude Code session: reminds Claude to
 * save the summary as the conversation grows, recovers it after a compaction,
 * follows git branch changes and answers instant shortcuts. It lives in the
 * MCP server, so it shares the session's active thread.
 */
export class HookGuard {
  private readonly watches = new Map<string, Watch>();
  /** The watch updated last, to report a conversation cleared unsaved */
  private lastWatch: Watch | null = null;
  /** The thread Claude was last told about */
  private announcedThread: string | null = null;
  private readonly touched = new Map<string, string[]>();

  constructor(
    private readonly services: Services,
    private readonly settings: HookSettings,
    private readonly cache = new SessionCache()
  ) {}

  async handle(call: HookCall): Promise<HookOutput | null> {
    switch (call.event) {
      case "session-start":
        return this.sessionStart(call);
      case "stop":
        return this.stop(call);
      case "pre-compact":
        return this.preCompact(call);
      case "user-prompt":
        return this.userPrompt(call);
      case "file-edited":
        return this.fileEdited(call);
      case "branch-check":
        return this.branchCheck();
    }
  }

  /**
   * The files edited on a thread since its summary was last saved, forgotten
   * once taken: summary_update records them as the thread's paths.
   */
  takeTouchedPaths(projectId: string, threadId: string): string[] {
    const key = threadKey(projectId, threadId);
    const paths = this.touched.get(key) ?? [];
    this.touched.delete(key);
    return paths;
  }

  private async sessionStart(call: HookCall): Promise<HookOutput | null> {
    const active = await this.services.session.active();
    if (!active) return null;

    const sessionId = present(call.session_id);
    const source = present(call.source) ?? "startup";
    const key = threadKey(active.projectId, active.threadId);
    const notes: string[] = [];
    let systemMessage: string | undefined;

    if (source === "compact") {
      const watch = sessionId ? this.watches.get(sessionId) : undefined;
      if (watch?.compactPending && watch.threadKey === key) {
        watch.compactPending = false;
        notes.push(
          `The conversation was just compacted before the summary of thread "${active.threadId}" was saved (${tokens(watch.unsaved)} of work). Before anything else, call summary_update to record the decisions, constraints, state and next steps from the conversation summary, then carry on.`
        );
      } else {
        notes.push(
          "The conversation was just compacted: if the compaction summary mentions decisions or progress missing from the ThreadMind summaries below, record them with summary_update."
        );
      }
    } else if (source === "clear") {
      const previous = this.lastWatch;
      if (
        previous &&
        previous.sessionId !== sessionId &&
        previous.unsaved >= this.minUnsaved() &&
        this.settings.reminders !== "off"
      ) {
        systemMessage = `ThreadMind: the conversation you cleared had ${tokens(previous.unsaved)} of work that was not saved in thread "${previous.threadId}"'s summary.`;
        previous.unsaved = 0;
      }
    }

    this.announcedThread = key;
    const additionalContext = await sessionContext(this.services, active, notes);
    if (sessionId) {
      await this.services.stats.recordSessionStart({
        sessionId,
        projectId: active.projectId,
        source,
        injectedTokens: estimateTokens(additionalContext),
      });
    }

    return {
      ...(systemMessage ? { systemMessage } : {}),
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext },
    };
  }

  /** At the end of each answer: remind to save the summary when it lags behind. */
  private async stop(call: HookCall): Promise<HookOutput | null> {
    const sessionId = present(call.session_id);
    const transcriptPath = present(call.transcript_path);
    if (!sessionId || !transcriptPath) return null;

    const current = await this.openThread();
    if (!current) return null;
    const watch = await this.observe(sessionId, transcriptPath, current);
    // Never chain reminders: Claude already answered one
    if (!watch || isTrue(call.stop_hook_active)) return null;
    if (this.settings.reminders === "off") return null;

    const every = this.settings.reminderTokens;
    const window = await this.contextWindow(sessionId, watch.lastSize);
    const nearlyFull =
      watch.lastSize >= (window.size * this.settings.contextThreshold) / 100;

    let urgent = false;
    if (nearlyFull && !watch.urgentSent && watch.unsaved >= this.minUnsaved()) {
      urgent = true;
      watch.urgentSent = true;
    } else if (
      watch.unsaved < every ||
      (watch.remindedAt !== null && watch.unsaved - watch.remindedAt < every)
    ) {
      return null;
    }
    watch.remindedAt = watch.unsaved;

    const unsaved = tokens(watch.unsaved);
    const thread = `"${watch.threadId}"`;
    const fullness = window.known
      ? `about ${Math.round((watch.lastSize / window.size) * 100)}% of the context window`
      : `${tokens(watch.lastSize)} long`;

    if (this.settings.reminders === "warn") {
      return {
        systemMessage: urgent
          ? `ThreadMind: the conversation is ${fullness} and ${unsaved} of it are not in thread ${thread}'s summary. Type tm:summary before it gets compacted.`
          : `ThreadMind: ${unsaved} of conversation since thread ${thread}'s summary was saved. Type tm:summary to save it.`,
      };
    }
    return {
      hookSpecificOutput: {
        hookEventName: "Stop",
        additionalContext: urgent
          ? `ThreadMind: the conversation is ${fullness} and the summary of thread ${thread} has not been saved for ${unsaved}. Before the conversation gets compacted, call summary_update to record its decisions, constraints, state and next steps. If nothing is worth keeping, end your turn.`
          : `ThreadMind: ${unsaved} of conversation since the summary of thread ${thread} was last saved. If this work produced decisions, constraints or progress worth keeping, record them now with summary_update (one section, or the whole structured summary). Otherwise, end your turn.`,
      },
    };
  }

  /**
   * Before a compaction: note the unsaved work, so the session that resumes
   * after it saves the summary first. Never blocks the compaction.
   */
  private async preCompact(call: HookCall): Promise<HookOutput | null> {
    const sessionId = present(call.session_id);
    const transcriptPath = present(call.transcript_path);
    if (!sessionId || !transcriptPath) return null;

    const current = await this.openThread();
    if (!current) return null;
    const watch = await this.observe(sessionId, transcriptPath, current);
    if (
      watch &&
      this.settings.compactSummary &&
      watch.unsaved >= this.minUnsaved()
    ) {
      watch.compactPending = true;
    }
    return null;
  }

  private async userPrompt(call: HookCall): Promise<HookOutput | null> {
    const prompt = present(call.prompt)?.trim();
    const command = prompt ? INSTANT_COMMAND.exec(prompt) : null;
    if (command && this.settings.instantCommands) {
      const text = await this.instantCommand(command[1].toLowerCase());
      if (text) {
        return {
          decision: "block",
          reason: text,
          hookSpecificOutput: {
            hookEventName: "UserPromptSubmit",
            suppressOriginalPrompt: true,
          },
        };
      }
    }

    // The user may have switched branches in their own terminal
    const change = await this.threadChange();
    return change
      ? {
          hookSpecificOutput: {
            hookEventName: "UserPromptSubmit",
            additionalContext: change,
          },
        }
      : null;
  }

  /** Remember the files Claude edits, to record them with the next summary. */
  private async fileEdited(call: HookCall): Promise<HookOutput | null> {
    const file = present(call.file_path);
    if (!file) return null;
    const active = await this.services.session.active();
    if (!active) return null;

    const root = await this.services.storage.workspaceRoot();
    const rel = relative(root, resolve(root, file));
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
    const path = rel.split(sep).join("/");
    if (path === DATA_DIR_NAME || path.startsWith(`${DATA_DIR_NAME}/`)) {
      return null;
    }

    const key = threadKey(active.projectId, active.threadId);
    const paths = (this.touched.get(key) ?? []).filter((p) => p !== path);
    paths.push(path);
    this.touched.set(key, paths.slice(-MAX_TOUCHED));
    return null;
  }

  /** After a git checkout: tell Claude when the active thread changed with the branch. */
  private async branchCheck(): Promise<HookOutput | null> {
    const change = await this.threadChange();
    return change
      ? {
          hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: change,
          },
        }
      : null;
  }

  private async instantCommand(command: string): Promise<string | null> {
    const active = await this.services.session.active();
    // Without a project, let Claude explain how to start
    if (!active) return null;
    return command === "tree"
      ? this.services.thread.list(active.projectId, active.threadId)
      : statsReport(this.services, active);
  }

  /**
   * The context of the new active thread when it changed since Claude was last
   * told, because the git branch changed. Null otherwise.
   */
  private async threadChange(): Promise<string | null> {
    const active = await this.services.session.active();
    if (!active) return null;

    const key = threadKey(active.projectId, active.threadId);
    const previous = this.announcedThread;
    this.announcedThread = key;
    if (previous === null || previous === key) return null;
    // Claude chose this thread itself (thread_switch, thread_create…)
    if (active.reason === "session") return null;

    const branch = active.branch
      ? `The checked-out git branch is now "${active.branch}", so`
      : "Since the last answer,";
    return sessionContext(this.services, active, [
      `${branch} ThreadMind's active thread changed to "${active.threadId}". Continue the work in this thread: its context follows.`,
    ]);
  }

  /** The session's active thread, unless there is none or it is closed. */
  private async openThread(): Promise<{
    active: ActiveThread;
    thread: ThreadNode;
  } | null> {
    const active = await this.services.session.active();
    if (!active) return null;
    const thread = await this.services.storage.readThread(
      active.projectId,
      active.threadId
    );
    // Nothing more to save in a finished thread
    if (thread.metadata.status) return null;
    return { active, thread };
  }

  /** Update a session's count of unsaved work from its transcript. */
  private async observe(
    sessionId: string,
    transcriptPath: string,
    { active, thread }: { active: ActiveThread; thread: ThreadNode }
  ): Promise<Watch | null> {
    const size = await conversationSize(transcriptPath);
    if (size === null) return null;

    const key = threadKey(active.projectId, active.threadId);
    const savedAt = thread.metadata.updatedAt;
    let watch = this.watches.get(sessionId);

    if (!watch || watch.threadKey !== key || watch.savedAt !== savedAt) {
      // First look at this session, another thread, or a summary just saved
      const unsaved =
        watch === undefined
          ? await this.unsavedSoFar(transcriptPath, savedAt, size)
          : 0;
      watch = {
        sessionId,
        threadKey: key,
        projectId: active.projectId,
        threadId: active.threadId,
        savedAt,
        lastSize: size,
        unsaved,
        remindedAt: null,
        urgentSent: false,
        compactPending: false,
      };
      this.watches.set(sessionId, watch);
    } else if (size < watch.lastSize / 2) {
      // Compacted: the context has room again, but the work is still unsaved
      watch.urgentSent = false;
      watch.lastSize = size;
    } else {
      watch.unsaved += Math.max(0, size - watch.lastSize);
      watch.lastSize = size;
    }

    this.lastWatch = watch;
    await this.cache.writeWatch(sessionId, {
      projectId: watch.projectId,
      threadId: watch.threadId,
      unsaved: watch.unsaved,
    });
    return watch;
  }

  /**
   * Work done in a transcript since a summary was saved: the growth since the
   * last turn before the save, or since the first turn if it was saved earlier.
   */
  private async unsavedSoFar(
    transcriptPath: string,
    savedAt: string,
    size: number
  ): Promise<number> {
    const turns = await transcriptTurns(transcriptPath);
    if (turns.length === 0) return 0;

    const saved = Date.parse(savedAt);
    let baseline = turns[0].prompt;
    for (const turn of turns) {
      if (!(Date.parse(turn.timestamp) <= saved)) break;
      baseline = turn.size;
    }
    return Math.max(0, size - baseline);
  }

  private async contextWindow(
    sessionId: string,
    size: number
  ): Promise<{ size: number; known: boolean }> {
    if (this.settings.contextWindow) {
      return { size: this.settings.contextWindow, known: true };
    }
    // Reported by the ThreadMind status line, when the user set it up
    const reported = await this.cache.readWindow(sessionId);
    if (reported) return { size: reported, known: true };
    return {
      size: size > DEFAULT_WINDOW ? LARGE_WINDOW : DEFAULT_WINDOW,
      known: false,
    };
  }

  private minUnsaved(): number {
    return Math.min(this.settings.reminderTokens, MIN_UNSAVED);
  }
}

function threadKey(projectId: string, threadId: string): string {
  return `${projectId}/${threadId}`;
}

/** A hook input value, unless Claude Code left it empty or unsubstituted. */
function present(value: string | undefined): string | undefined {
  return value && !value.startsWith("${") ? value : undefined;
}

function isTrue(value: boolean | string | undefined): boolean {
  return value === true || value === "true";
}

/** "~45k tokens" */
function tokens(count: number): string {
  return count >= 1_000
    ? `~${Math.round(count / 1_000)}k tokens`
    : `~${count} tokens`;
}
