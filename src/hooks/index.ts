import { join, resolve } from "node:path";
import { createServices } from "../services.js";
import { DATA_DIR_NAME } from "../core/workspace.js";
import { estimateTokens } from "../core/context.js";
import { sessionContext } from "./session-context.js";
import { conversationSize } from "./transcript.js";
import type { Services } from "../types/index.js";

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

/**
 * Entry point of `thread-mind-mcp hook <event>`, run by the Claude Code
 * plugin. Reads the hook input on stdin and writes the hook output on stdout.
 * The hooks that run during a session call the server's threadmind_hook tool
 * instead, so that they share the session's active thread.
 */
export async function runHook(event: string | undefined): Promise<void> {
  const output = await handleHook(event, await readStdinJson<HookInput>());
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

  const notes =
    input.source === "compact"
      ? [
          "The conversation was just compacted: if the compaction summary mentions decisions or progress missing from the ThreadMind summaries below, record them with summary_update.",
        ]
      : [];
  const additionalContext = await sessionContext(services, active, notes);

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

/** Read a JSON object from stdin, as Claude Code sends hook and status line input. */
export async function readStdinJson<T extends object>(): Promise<T> {
  if (process.stdin.isTTY) return {} as T;
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  if (!raw.trim()) return {} as T;
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null
    ? (parsed as T)
    : ({} as T);
}
