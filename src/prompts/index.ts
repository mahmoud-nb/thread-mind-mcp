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
  const { storage, context, thread, stats } = services;

  const threadIdArg = (description: string) =>
    completable(z.string().describe(description), (value) =>
      completeThreadIds(storage, value)
    );

  // ==========================================================================
  // Read-only prompts: the result is embedded, no tool call needed
  // ==========================================================================

  const loadContext = async () => {
    const state = await storage.readConfig();
    if (!state.activeProjectId) return userMessage(NO_PROJECT);

    const threadId = state.activeThreadId ?? "main";
    const result = await context.assemble(state.activeProjectId, threadId);
    return userMessage(
      `Here is the ThreadMind context of the active thread "${threadId}". Use it as your working context:\n\n${formatContext(result)}`
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
      const state = await storage.readConfig();
      if (!state.activeProjectId) return userMessage(NO_PROJECT);

      const tree = await thread.list(state.activeProjectId);
      return userMessage(
        `Show the user this ThreadMind thread tree:\n\n\`\`\`\n${tree}\n\`\`\``
      );
    }
  );

  server.registerPrompt(
    "tm-stats",
    {
      title: "Show token statistics",
      description: "Show token savings statistics of the active project",
    },
    async () => {
      const state = await storage.readConfig();
      if (!state.activeProjectId) return userMessage(NO_PROJECT);

      const projectConfig = await storage.readProjectConfig(
        state.activeProjectId
      );
      const projectStats = await stats.getProjectStats(state.activeProjectId);
      const result = await context.assemble(
        state.activeProjectId,
        state.activeThreadId ?? "main"
      );
      const tree = await storage.readTree(state.activeProjectId);

      const report = formatStatsReport({
        projectTitle: projectConfig.title,
        stats: projectStats,
        threadCount: Object.keys(tree.nodes).length,
        context: result,
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
      const state = await storage.readConfig();
      const statusLine = state.activeProjectId
        ? `\nActive project: **${state.activeProjectId}** | Active thread: **${state.activeThreadId ?? "main"}**\n`
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
| \`thread_create\` | Create child thread |
| \`thread_switch\` | Switch thread and load its context |
| \`thread_list\` | Show thread tree |
| \`thread_delete\` | Delete thread + descendants |
| \`thread_rebase\` | Move thread to a different parent |
| \`summary_update\` | Update thread summary |
| \`context_get\` | Get assembled context |
| \`threadmind_init\` | Generate instruction files for other AI agents |
| \`stats_show\` | Token savings statistics |

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

    const state = await storage.readConfig();
    const threadId = state.activeThreadId ?? "main";

    let currentSummary = "";
    if (state.activeProjectId) {
      try {
        const node = await storage.readThread(state.activeProjectId, threadId);
        currentSummary = node.content
          ? `\n\nCurrent summary (to update/replace):\n${node.content}`
          : "";
      } catch {
        // Thread may not exist yet
      }
    }

    const topicHint = topic ? `\nThe discussion was about: ${topic}` : "";

    return userMessage(`Please generate a concise summary (5-15 lines) for the current ThreadMind thread "${threadId}".${topicHint}${currentSummary}

The summary should capture:
- **Decisions made** and their rationale
- **Technical choices** and trade-offs considered
- **Current state** of the implementation
- **Open questions** or next steps (if any)

Format the summary as clean markdown. Focus on WHAT was decided and WHY — not on the conversation itself. The summary should be self-contained: a developer reading it with no prior context should understand the current state. It replaces the current summary, so keep what is still true.

After generating the summary, call \`summary_update\` with the content to save it.`);
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
