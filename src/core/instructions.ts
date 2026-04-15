import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export type ClientTarget = "claude" | "cursor" | "generic";

const ALL_CLIENTS: ClientTarget[] = ["claude", "cursor", "generic"];

interface GenerateResult {
  files: { path: string; client: ClientTarget }[];
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

function claudeInstructions(projectTitle: string): string {
  return `${coreInstructions(projectTitle)}

### Claude Code Specifics

- ThreadMind tools are available via MCP — call them directly
- Use \`context_get\` output as your working context, not the chat history
- When the user starts a new session, proactively call \`context_get\` before answering
- After completing a task, proactively suggest updating the thread summary
`;
}

function cursorInstructions(projectTitle: string): string {
  return `${coreInstructions(projectTitle)}

### Cursor Specifics

- ThreadMind tools are available via MCP server
- Always call \`context_get\` at the start of a conversation to load project context
- Summarize completed work using \`summary_update\` before ending a session
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

export async function generateInstructions(opts: {
  projectTitle: string;
  basePath: string;
  clients?: ClientTarget[];
}): Promise<GenerateResult> {
  const clients = opts.clients ?? ALL_CLIENTS;
  const result: GenerateResult = { files: [] };

  for (const client of clients) {
    const content = getInstructionContent(client, opts.projectTitle);
    const filePath = getFilePath(client, opts.basePath);
    await writeFile(filePath, content, "utf-8");
    result.files.push({ path: filePath, client });
  }

  return result;
}
