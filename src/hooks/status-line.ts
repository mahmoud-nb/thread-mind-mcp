import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServices } from "../services.js";
import { DATA_DIR_NAME } from "../core/workspace.js";
import { hookSettings } from "./settings.js";
import { SessionCache } from "./session-cache.js";
import { readStdinJson } from "./index.js";

/** The fields ThreadMind reads from Claude Code's status line input. */
export interface StatusLineInput {
  session_id?: string;
  cwd?: string;
  workspace?: { current_dir?: string; project_dir?: string };
  context_window?: {
    context_window_size?: number;
    used_percentage?: number | null;
  };
}

/** Entry point of `thread-mind-mcp status-line`, set as Claude Code's statusLine command. */
export async function runStatusLine(): Promise<void> {
  const line = await statusLine(await readStdinJson<StatusLineInput>());
  if (line) process.stdout.write(`${line}\n`);
}

/**
 * One line showing the active thread, its branch, when its summary was saved,
 * how much work is unsaved and how full the context is. Empty outside a
 * ThreadMind workspace.
 */
export async function statusLine(
  input: StatusLineInput,
  env: NodeJS.ProcessEnv = process.env,
  cache = new SessionCache(),
  now = Date.now()
): Promise<string> {
  const sessionId = input.session_id;
  const windowSize = input.context_window?.context_window_size;
  // Lets the server's reminders use the real context window size
  if (sessionId && typeof windowSize === "number" && windowSize > 0) {
    await cache.writeWindow(sessionId, windowSize);
  }

  const root = resolve(
    env.THREADMIND_ROOT?.trim() ||
      input.workspace?.project_dir ||
      input.workspace?.current_dir ||
      input.cwd ||
      process.cwd()
  );
  if (!existsSync(join(root, DATA_DIR_NAME))) return "";

  const services = createServices(join(root, DATA_DIR_NAME));
  const active = await services.session.active();
  if (!active) return "";
  const { metadata, content } = await services.storage.readThread(
    active.projectId,
    active.threadId
  );

  const parts = [
    `🧵 ${active.threadId}${metadata.status ? ` [${metadata.status}]` : ""}`,
  ];
  if (active.branch) parts.push(active.branch);
  parts.push(
    content.trim() ? `saved ${ago(metadata.updatedAt, now)}` : "no summary yet"
  );

  const watch = sessionId ? await cache.readWatch(sessionId) : null;
  if (
    watch &&
    watch.projectId === active.projectId &&
    watch.threadId === active.threadId &&
    watch.unsaved >= 1_000
  ) {
    const late = watch.unsaved >= hookSettings(env).reminderTokens;
    parts.push(`${late ? "⚠ " : ""}~${Math.round(watch.unsaved / 1_000)}k unsaved`);
  }

  const used = input.context_window?.used_percentage;
  if (typeof used === "number") parts.push(`ctx ${Math.round(used)}%`);
  return parts.join(" · ");
}

function ago(iso: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (!(minutes >= 1)) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
