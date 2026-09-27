import { open } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createServices } from "../services.js";
import { DATA_DIR_NAME } from "../core/workspace.js";
import { estimateTokens, formatContext } from "../core/context.js";
import type { ActiveThread, Services } from "../types/index.js";

/** The fields ThreadMind reads from Claude Code's hook input. */
export interface HookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  /** SessionStart: startup, resume, clear, compact or fork */
  source?: string;
  /** SessionEnd: clear, resume, logout, prompt_input_exit or other */
  reason?: string;
}

/** Only the end of a transcript is read to find its last turn. */
const TRANSCRIPT_TAIL_BYTES = 512 * 1024;

/**
 * Entry point of `thread-mind-mcp hook <event>`, run by the Claude Code
 * plugin. Reads the hook input on stdin and writes the hook output on stdout.
 */
export async function runHook(event: string | undefined): Promise<void> {
  const output = await handleHook(event, await readInput());
  if (output) process.stdout.write(output);
}

/** Run a hook and return what it prints, if anything. */
export async function handleHook(
  event: string | undefined,
  input: HookInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<string | null> {
  const root = resolve(
    env.THREADMIND_ROOT?.trim() ||
      env.CLAUDE_PROJECT_DIR ||
      input.cwd ||
      process.cwd()
  );
  const services = createServices(join(root, DATA_DIR_NAME));

  switch (event) {
    case "session-start":
      return sessionStart(services, input);
    case "session-end":
      await sessionEnd(services, input);
      return null;
    default:
      throw new Error(`Unknown hook "${event}"`);
  }
}

/** Load the active thread's context into the new session. */
async function sessionStart(
  services: Services,
  input: HookInput
): Promise<string | null> {
  // Without a project, add nothing (and create nothing)
  const active = await services.session.active();
  if (!active) return null;

  const project = await services.project.get(active.projectId);
  const result = await services.context.assemble(
    active.projectId,
    active.threadId
  );

  const intro = [
    `ThreadMind context for this session — project "${project.title}", active thread "${active.threadId}"${origin(active)}. It is already loaded: no need to call context_get.`,
    input.source === "compact"
      ? "The conversation was just compacted: if the compaction summary mentions decisions or progress missing from the ThreadMind summaries below, record them with summary_update."
      : null,
  ]
    .filter(Boolean)
    .join("\n");
  const additionalContext = `${intro}\n\n${formatContext(result)}`;

  if (input.session_id) {
    await services.stats.recordSessionStart({
      sessionId: input.session_id,
      projectId: active.projectId,
      source: input.source ?? "startup",
      injectedTokens: estimateTokens(additionalContext),
    });
  }

  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext,
    },
  });
}

/** Record how large the conversation grew before the session ended. */
async function sessionEnd(services: Services, input: HookInput): Promise<void> {
  if (!input.session_id) return;
  // Only measure workspaces that use ThreadMind
  if ((await services.project.list()).length === 0) return;

  await services.stats.recordSessionEnd({
    sessionId: input.session_id,
    reason: input.reason ?? "other",
    finalContextTokens: input.transcript_path
      ? await conversationSize(input.transcript_path)
      : null,
  });
}

function origin(active: ActiveThread): string {
  switch (active.reason) {
    case "branch":
      return `, linked to git branch "${active.branch}"`;
    case "branch-memory":
      return `, last used on git branch "${active.branch}"`;
    case "last-used":
      return ", last used";
    default:
      return "";
  }
}

/**
 * Size in tokens of a conversation when it ended: the prompt of its last
 * assistant turn plus that turn's answer, read from the transcript's usage
 * data. Null when the transcript has none.
 */
export async function conversationSize(
  transcriptPath: string
): Promise<number | null> {
  let tail: string;
  try {
    const handle = await open(transcriptPath, "r");
    try {
      const { size } = await handle.stat();
      const length = Math.min(size, TRANSCRIPT_TAIL_BYTES);
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, size - length);
      tail = buffer.toString("utf-8");
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }

  const lines = tail.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const usage = assistantUsage(lines[i]);
    if (usage) {
      return (
        usage.input_tokens +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0) +
        (usage.output_tokens ?? 0)
      );
    }
  }
  return null;
}

interface Usage {
  input_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
}

/** The usage of a main-conversation assistant entry, if the line is one. */
function assistantUsage(line: string): Usage | null {
  let entry: unknown;
  try {
    entry = JSON.parse(line);
  } catch {
    // Blank, or cut by the tail read
    return null;
  }
  if (typeof entry !== "object" || entry === null) return null;

  const record = entry as {
    type?: unknown;
    isSidechain?: unknown;
    message?: { usage?: Partial<Record<keyof Usage, unknown>> };
  };
  // Subagent turns have their own, smaller context
  if (record.type !== "assistant" || record.isSidechain === true) return null;

  const usage = record.message?.usage;
  if (!usage || typeof usage.input_tokens !== "number") return null;
  const count = (value: unknown) => (typeof value === "number" ? value : 0);
  return {
    input_tokens: usage.input_tokens,
    cache_creation_input_tokens: count(usage.cache_creation_input_tokens),
    cache_read_input_tokens: count(usage.cache_read_input_tokens),
    output_tokens: count(usage.output_tokens),
  };
}

async function readInput(): Promise<HookInput> {
  if (process.stdin.isTTY) return {};
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  if (!raw.trim()) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null
    ? (parsed as HookInput)
    : {};
}
