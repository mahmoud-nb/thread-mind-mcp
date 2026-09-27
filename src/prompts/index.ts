import { z } from "zod";
import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Services } from "../types/index.js";
import { formatContext } from "../core/context.js";
import { formatStatsReport } from "../core/stats.js";
import { completeThreadIds } from "../core/thread.js";
import { SHORTCUTS } from "../core/instructions.js";

const NO_PROJECT =
  "There is no active ThreadMind project. Tell the user to create one with `project_create`, or to select one with `project_switch`.";

export function registerPrompts(
  server: McpServer,
  services: Services
): void {
  const { storage, context, thread, stats, session } = services;

  const threadIdArg = (description: string) =>
    completable(z.string().describe(description), (value) =>
      completeThreadIds(storage, session, value)
    );

  // ==========================================================================
  // Read-only prompts: the result is embedded, no tool call needed
  // ==========================================================================

  const loadContext = async () => {
    const active = await session.active();
    if (!active) return userMessage(NO_PROJECT);

    const result = await context.assemble(active.projectId, active.threadId);
    return userMessage(
      `Here is the ThreadMind context of the active thread "${active.threadId}". Use it as your working context:\n\n${formatContext(result)}`
    );
  };

  server.registerPrompt(
    "tm-context",
    {
      title: "Load thread context",
      description:
        "Load the assembled context of the active thread into the conversation",
    },
    loadContext
  );

  server.registerPrompt(
    "start-thread",
    {
      title: "Load thread context",
      description: "Same as tm-context, kept for compatibility",
    },
    loadContext
  );

  server.registerPrompt(
    "tm-tree",
    {
      title: "Show thread tree",
      description: "Show the thread tree of the active project",
    },
    async () => {
      const active = await session.active();
      if (!active) return userMessage(NO_PROJECT);

      const tree = await thread.list(active.projectId, active.threadId);
      return userMessage(
        `Show the user this ThreadMind thread tree:\n\n\`\`\`\n${tree}\n\`\`\``
      );
    }
  );

  server.registerPrompt(
    "tm-stats",
    {
      title: "Show statistics",
      description:
        "Show summary sizes and measured conversation sizes of the active project",
    },
    async () => {
      const active = await session.active();
      if (!active) return userMessage(NO_PROJECT);

      const projectConfig = await storage.readProjectConfig(active.projectId);
      const result = await context.assemble(active.projectId, active.threadId);
      const report = formatStatsReport({
        projectTitle: projectConfig.title,
        threads: await storage.listThreads(active.projectId),
        activeThreadId: active.threadId,
        context: result,
        sessions: await stats.sessions(),
      });
      return userMessage(
        `Show the user these ThreadMind statistics:\n\n\`\`\`\n${report}\n\`\`\``
      );
    }
  );

  server.registerPrompt(
    "tm-help",
    {
      title: "ThreadMind help",
      description: "Show all available ThreadMind commands and tools",
    },
    async () => {
      const active = await session.active();
      const statusLine = active
        ? `\nActive project: **${active.projectId}** | Active thread: **${active.threadId}**\n`
        : "";
      const shortcuts = SHORTCUTS.map(([s, a]) => `| \`${s}\` | ${a} |`).join(
        "\n"
      );

      return userMessage(`Show the user this ThreadMind command reference:${statusLine}

## ThreadMind Commands

### Quick shortcuts (type in chat)
| Shortcut | Action |
|----------|--------|
${shortcuts}

### MCP Tools (called by AI)
| Tool | Description |
|------|-------------|
| \`project_create\` | Create a new project |
| \`project_list\` | List all projects |
| \`project_switch\` | Switch project |
| \`thread_create\` | Create child thread (linked to the current feature branch) |
| \`thread_switch\` | Switch thread and load its context |
| \`thread_list\` | Show thread tree |
| \`thread_status\` | Mark a thread done, abandoned or active |
| \`thread_merge\` | Fold a finished thread into its parent |
| \`thread_delete\` | Delete thread + descendants |
| \`thread_rebase\` | Move thread to a different parent |
| \`summary_update\` | Update a thread summary, or one of its sections |
| \`context_get\` | Get assembled context |
| \`threadmind_init\` | Generate instruction files for other AI agents |
| \`stats_show\` | Summary sizes and measured conversation sizes |

### MCP Prompts (slash commands in Claude Code)
\`tm-context\`, \`tm-tree\`, \`tm-stats\`, \`tm-create\`, \`tm-switch\`, \`tm-summary\`, \`tm-rebase\`, \`tm-init\` and \`tm-help\` are available as \`/mcp__thread-mind__<name>\`.`);
    }
  );

  // ==========================================================================
  // Prompts that change state: they go through a tool, so the client's
  // approval flow applies
  // ==========================================================================

  server.registerPrompt(
    "tm-create",
    {
      title: "Create thread",
      description: "Create a new child thread (shortcut for thread_create)",
      argsSchema: {
        title: z.string().describe("Title for the new thread"),
      },
    },
    async ({ title }) =>
      userMessage(`Call the \`thread_create\` tool now with title "${title}".`)
  );

  server.registerPrompt(
    "tm-switch",
    {
      title: "Switch thread",
      description: "Switch to a different thread (shortcut for thread_switch)",
      argsSchema: {
        threadId: threadIdArg("Thread ID to switch to"),
      },
    },
    async ({ threadId }) =>
      userMessage(
        `Call the \`thread_switch\` tool now with threadId "${threadId}".`
      )
  );

  server.registerPrompt(
    "tm-rebase",
    {
      title: "Move thread",
      description:
        "Move a thread to a different parent (shortcut for thread_rebase)",
      argsSchema: {
        threadId: threadIdArg("Thread ID to move"),
        newParentId: threadIdArg("New parent thread ID"),
      },
    },
    async ({ threadId, newParentId }) =>
      userMessage(
        `Call the \`thread_rebase\` tool now with threadId "${threadId}" and newParentId "${newParentId}".`
      )
  );

  const summarize = async ({
    content,
    topic,
  }: {
    content?: string;
    topic?: string;
  }) => {
    if (content) {
      return userMessage(
        `Call the \`summary_update\` tool now with this content:\n\n${content}`
      );
    }

    const active = await session.active();
    const threadId = active?.threadId ?? "main";

    let currentSummary = "";
    if (active) {
      try {
        const node = await storage.readThread(active.projectId, threadId);
        currentSummary = node.content
          ? `\n\nCurrent summary (to update/replace):\n${node.content}`
          : "";
      } catch {
        // Thread may not exist yet
      }
    }

    const topicHint = topic ? `\nThe discussion was about: ${topic}` : "";

    return userMessage(`Please write the summary of the current ThreadMind thread "${threadId}".${topicHint}${currentSummary}

Use these sections, leaving out the empty ones:
## Decisions — what was decided and why
## Constraints — requirements and limits that must keep holding
## State — where the work stands
## Open questions
## Next steps

Child threads inherit only Decisions and Constraints, so put anything durable there. Focus on WHAT was decided and WHY — not on the conversation itself. The summary should be self-contained: a developer reading it with no prior context should understand the current state. It replaces the current summary, so keep what is still true.

Then call \`summary_update\` with the content to save it, with \`paths\` listing the files or directories this thread is about.`);
  };

  server.registerPrompt(
    "tm-summary",
    {
      title: "Update thread summary",
      description:
        "Update the summary of the active thread: saves the given content, or asks the AI to write it",
      argsSchema: {
        content: z
          .string()
          .optional()
          .describe("Summary content. If omitted, the AI writes it."),
        topic: z
          .string()
          .optional()
          .describe(
            "What the discussion was about (helps the AI write the summary)"
          ),
      },
    },
    summarize
  );

  server.registerPrompt(
    "summarize-thread",
    {
      title: "Summarize thread",
      description:
        "Same as tm-summary without content, kept for compatibility",
      argsSchema: {
        topic: z
          .string()
          .optional()
          .describe(
            "Brief description of what was discussed (helps guide the summary)"
          ),
      },
    },
    ({ topic }) => summarize({ topic })
  );

  server.registerPrompt(
    "tm-init",
    {
      title: "Generate instruction files",
      description:
        "Generate instruction files such as AGENTS.md for other AI agents (shortcut for threadmind_init)",
    },
    async () =>
      userMessage(
        "Call the `threadmind_init` tool now to generate instruction files."
      )
  );
}

function userMessage(text: string) {
  return {
    messages: [
      {
        role: "user" as const,
        content: { type: "text" as const, text },
      },
    ],
  };
}
