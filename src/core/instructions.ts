import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const CLIENT_TARGETS = ["agents", "claude", "cursor", "generic"] as const;
export type ClientTarget = (typeof CLIENT_TARGETS)[number];

/**
 * Claude Code and other clients that read MCP server instructions need no
 * file: AGENTS.md covers most other agents (Codex, Cursor, Copilot…).
 */
export const DEFAULT_CLIENTS: ClientTarget[] = ["agents", "generic"];

const MARKER_START = "<!-- threadmind:start -->";
const MARKER_END = "<!-- threadmind:end -->";

/** Text shortcuts the user may type, and the tool each one maps to. */
export const SHORTCUTS: readonly (readonly [shortcut: string, action: string])[] = [
  ["tm:context", "context_get"],
  ["tm:tree", "thread_list"],
  ["tm:create <title>", "thread_create"],
  ["tm:switch <id>", "thread_switch"],
  ["tm:summary [content]", "summary_update (write the summary yourself when no content is given)"],
  ["tm:delete <id>", "thread_delete"],
  ["tm:rebase <id> <new-parent-id>", "thread_rebase"],
  ["tm:stats", "stats_show"],
  ["tm:project <title>", "project_create"],
  ["tm:projects", "project_list"],
  ["tm:init", "threadmind_init"],
  ["tm:help", "list these shortcuts"],
];

/**
 * How to use ThreadMind, sent to clients as the MCP server instructions and
 * reused in the generated instruction files.
 */
export function serverInstructions(): string {
  const shortcuts = SHORTCUTS.map(([s, a]) => `${s} → ${a}`).join("; ");
  return [
    "ThreadMind keeps the context of this workspace as a tree of threads. Each thread holds a short markdown summary; the context of a thread is the chain of summaries from the root down to it.",
    "",
    "- At the start of a session, call context_get once. If it reports that there is no project, don't call ThreadMind tools again unless the user asks for it.",
    "- After a decision, a resolved problem or a completed task, call summary_update with a self-contained summary of 5-15 lines: decisions and their rationale, current state, open questions and next steps. It replaces the previous summary, so keep what is still true.",
    "- When the work moves to another topic, check thread_list, then thread_switch to an existing thread (it returns that thread's context) or thread_create a new one.",
    `- The user may type shortcuts; run the matching tool right away, without asking for confirmation: ${shortcuts}.`,
  ].join("\n");
}

function fileSection(projectTitle: string): string {
  return `## ThreadMind — Context Management

This project uses the **ThreadMind MCP server** (project: "${projectTitle}").

${serverInstructions()}`;
}

function cursorRule(projectTitle: string): string {
  return `---
description: ThreadMind context management
alwaysApply: true
---

${fileSection(projectTitle)}
`;
}

function getFilePath(client: ClientTarget, basePath: string): string {
  switch (client) {
    case "agents":
      return join(basePath, "AGENTS.md");
    case "claude":
      return join(basePath, "CLAUDE.md");
    case "cursor":
      return join(basePath, ".cursor", "rules", "threadmind.mdc");
    case "generic":
      return join(basePath, ".threadmind", "instructions.md");
  }
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Write a ThreadMind section into a file using markers.
 * - File does not exist: create it with the section wrapped in markers.
 * - File exists with markers: replace only the section between markers.
 * - File exists without markers: append the section at the end.
 *
 * Markers ensure existing user content is never overwritten.
 */
async function writeWithMarkers(
  filePath: string,
  section: string
): Promise<"created" | "updated" | "appended"> {
  const block = `${MARKER_START}\n${section}\n${MARKER_END}`;
  const existing = await readIfExists(filePath);

  if (existing === null) {
    await writeFile(filePath, block + "\n", "utf-8");
    return "created";
  }

  if (existing.includes(MARKER_START)) {
    const startIdx = existing.indexOf(MARKER_START);
    const endIdx = existing.indexOf(MARKER_END, startIdx);
    if (endIdx === -1) {
      // Replacing up to the end of the file could destroy user content
      throw new Error(
        `${filePath} contains ${MARKER_START} without a matching ${MARKER_END}. Restore the end marker (or remove the start marker), then run threadmind_init again.`
      );
    }
    const updated =
      existing.slice(0, startIdx) +
      block +
      existing.slice(endIdx + MARKER_END.length);
    await writeFile(filePath, updated, "utf-8");
    return "updated";
  }

  await writeFile(filePath, existing.trimEnd() + "\n\n" + block + "\n", "utf-8");
  return "appended";
}

/** Write a file that ThreadMind owns entirely. */
async function writeOwnedFile(
  filePath: string,
  content: string
): Promise<"created" | "updated"> {
  const existed = (await readIfExists(filePath)) !== null;
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
  return existed ? "updated" : "created";
}

function hasSection(content: string | null): content is string {
  if (content === null) return false;
  const startIdx = content.indexOf(MARKER_START);
  return startIdx !== -1 && content.indexOf(MARKER_END, startIdx) !== -1;
}

/**
 * Remove the ThreadMind section from a file, and the file itself if nothing
 * else remains. Returns whether a section was removed.
 */
async function removeSection(filePath: string): Promise<boolean> {
  const existing = await readIfExists(filePath);
  if (!hasSection(existing)) return false;

  const startIdx = existing.indexOf(MARKER_START);
  const endIdx = existing.indexOf(MARKER_END, startIdx) + MARKER_END.length;
  const rest = (
    existing.slice(0, startIdx).trimEnd() +
    "\n\n" +
    existing.slice(endIdx).trimStart()
  ).trim();

  if (rest) {
    await writeFile(filePath, rest + "\n", "utf-8");
  } else {
    await unlink(filePath);
  }
  return true;
}

export interface GenerateResult {
  files: {
    path: string;
    client: ClientTarget;
    action: "created" | "updated" | "appended";
  }[];
  /** Leftovers from earlier versions that the user may want to clean up. */
  notes: string[];
}

export async function generateInstructions(opts: {
  projectTitle: string;
  basePath: string;
  clients?: ClientTarget[];
}): Promise<GenerateResult> {
  const clients = opts.clients ?? DEFAULT_CLIENTS;
  const result: GenerateResult = { files: [], notes: [] };

  for (const client of clients) {
    const filePath = getFilePath(client, opts.basePath);
    const action =
      client === "cursor"
        ? await writeOwnedFile(filePath, cursorRule(opts.projectTitle))
        : await writeWithMarkers(filePath, fileSection(opts.projectTitle));
    result.files.push({ path: filePath, client, action });
  }

  // Earlier versions wrote Cursor instructions to the legacy .cursorrules file
  const legacyCursorPath = join(opts.basePath, ".cursorrules");
  if (clients.includes("cursor")) {
    if (await removeSection(legacyCursorPath)) {
      result.notes.push(
        `Moved the ThreadMind section out of ${legacyCursorPath}, Cursor's legacy rules file.`
      );
    }
  } else if (hasSection(await readIfExists(legacyCursorPath))) {
    result.notes.push(
      `${legacyCursorPath} still contains a ThreadMind section. It is Cursor's legacy rules file and Cursor also reads AGENTS.md: remove the section between the threadmind markers.`
    );
  }

  const claudePath = join(opts.basePath, "CLAUDE.md");
  if (!clients.includes("claude") && hasSection(await readIfExists(claudePath))) {
    result.notes.push(
      `${claudePath} still contains a ThreadMind section. Claude Code now receives these instructions from the MCP server: remove the section between the threadmind markers so they are not loaded twice.`
    );
  }

  return result;
}
