import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type ClientTarget = "claude" | "cursor" | "generic";

const ALL_CLIENTS: ClientTarget[] = ["claude", "cursor", "generic"];

const MARKER_START = "<!-- threadmind:start -->";
const MARKER_END = "<!-- threadmind:end -->";

interface GenerateResult {
  files: { path: string; client: ClientTarget; action: "created" | "updated" | "appended" }[];
}

/**
 * Core instructions that are shared across all client files.
 * These tell the AI how to use ThreadMind effectively.
 */
function coreInstructions(projectTitle: string): string {
  return `## ThreadMind — Context Management

This project uses **ThreadMind MCP** to organize conversations into a thread tree.
Project: "${projectTitle}"

### Mandatory Workflow

1. **At the start of every session**, call \`context_get\` to load the structured context for the active thread. Use this context as the foundation for your responses — it contains the decisions, architecture, and state from prior discussions.

2. **After every significant discussion** (architecture decisions, implementation choices, bug resolutions), call \`summary_update\` with a concise summary (5-15 lines) focused on:
   - Decisions made and their rationale
   - Technical choices and trade-offs
   - Current implementation state
   - Open questions or next steps

3. **When the topic shifts** to a different area (e.g., from backend to frontend, from auth to payments), call \`thread_create\` to branch into a new sub-thread. This keeps each thread focused.

4. **Before creating new threads**, call \`thread_list\` to see the current tree and avoid duplicating existing threads.

5. **When switching focus** to a different part of the codebase, call \`thread_switch\` to change the active thread before continuing the discussion.

### Key Principle

The assembled context from \`context_get\` REPLACES the need for conversation history. Write summaries as if a new developer will read them with no prior context — they should be self-contained and actionable.`;
}

/**
 * Quick shortcuts section — shared across all clients.
 * Maps short tm: commands to MCP tool calls.
 */
function shortcutsSection(): string {
  return `
### Quick Shortcuts

The user can type these shortcuts in chat. When you see one, **immediately call the corresponding tool** without asking for confirmation:

| User types | Action |
|------------|--------|
| \`tm:help\` | Show all available ThreadMind commands (list the table below) |
| \`tm:context\` | Call \`context_get\` and display the result |
| \`tm:tree\` | Call \`thread_list\` and display the tree |
| \`tm:create <title>\` | Call \`thread_create\` with the given title |
| \`tm:switch <id>\` | Call \`thread_switch\` with the given thread ID |
| \`tm:rebase <id> <newParentId>\` | Call \`thread_rebase\` to move the thread to a new parent |
| \`tm:summary\` | Generate a summary of the current discussion, then call \`summary_update\` |
| \`tm:summary <content>\` | Call \`summary_update\` with the given content |
| \`tm:delete <id>\` | Call \`thread_delete\` with the given thread ID |
| \`tm:stats\` | Call \`stats_show\` and display token savings |
| \`tm:init\` | Call \`threadmind_init\` to generate instruction files |
| \`tm:project <title>\` | Call \`project_create\` with the given title |
| \`tm:projects\` | Call \`project_list\` |

**Important**: When you see \`tm:<command>\`, execute the tool call immediately. Do not ask "would you like me to..." — just do it.`;
}

function claudeInstructions(projectTitle: string): string {
  return `${coreInstructions(projectTitle)}

### Claude Code Specifics

- ThreadMind tools are available via MCP — call them directly
- Use \`context_get\` output as your working context, not the chat history
- When the user starts a new session, proactively call \`context_get\` before answering
- After completing a task, proactively suggest updating the thread summary
- MCP Prompts are available as slash commands: \`/mcp__thread-mind__tm-help\`, \`/mcp__thread-mind__tm-create\`, etc.
${shortcutsSection()}
`;
}

function cursorInstructions(projectTitle: string): string {
  return `${coreInstructions(projectTitle)}

### Cursor Specifics

- ThreadMind tools are available via MCP server
- Always call \`context_get\` at the start of a conversation to load project context
- Summarize completed work using \`summary_update\` before ending a session
${shortcutsSection()}
`;
}

function genericInstructions(projectTitle: string): string {
  return `${coreInstructions(projectTitle)}

### Usage with Any MCP Client

- Ensure ThreadMind MCP server is configured in your client
- Call \`context_get\` at the start of every session
- Call \`summary_update\` after meaningful discussions
- Call \`thread_create\` when changing topics
- Call \`thread_list\` to see the current thread tree
${shortcutsSection()}
`;
}

function getInstructionContent(
  client: ClientTarget,
  projectTitle: string
): string {
  switch (client) {
    case "claude":
      return claudeInstructions(projectTitle);
    case "cursor":
      return cursorInstructions(projectTitle);
    case "generic":
      return genericInstructions(projectTitle);
  }
}

function getFilePath(client: ClientTarget, basePath: string): string {
  switch (client) {
    case "claude":
      return join(basePath, "CLAUDE.md");
    case "cursor":
      return join(basePath, ".cursorrules");
    case "generic":
      return join(basePath, ".threadmind", "instructions.md");
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

  let existing: string | null = null;
  try {
    existing = await readFile(filePath, "utf-8");
  } catch {
    // file does not exist — will create
  }

  if (existing === null) {
    await writeFile(filePath, block + "\n", "utf-8");
    return "created";
  }

  if (existing.includes(MARKER_START)) {
    const startIdx = existing.indexOf(MARKER_START);
    const endIdx = existing.indexOf(MARKER_END);
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

export async function generateInstructions(opts: {
  projectTitle: string;
  basePath: string;
  clients?: ClientTarget[];
}): Promise<GenerateResult> {
  const clients = opts.clients ?? ALL_CLIENTS;
  const result: GenerateResult = { files: [] };

  for (const client of clients) {
    const section = getInstructionContent(client, opts.projectTitle);
    const filePath = getFilePath(client, opts.basePath);
    const action = await writeWithMarkers(filePath, section);
    result.files.push({ path: filePath, client, action });
  }

  return result;
}
