import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Services } from "../types/index.js";

export function registerPrompts(
  server: McpServer,
  services: Services
): void {
  const { storage, context, thread, stats } = services;

  // ==========================================================================
  // Context & Session prompts
  // ==========================================================================

  // --- start-thread ---
  server.prompt(
    "start-thread",
    "Load the assembled ThreadMind context for the active thread. Use this at the start of every conversation to inject structured context instead of relying on chat history.",
    {},
    async () => {
      const state = await storage.readConfig();
      if (!state.activeProjectId || !state.activeThreadId) {
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: "No active ThreadMind project. Please call `project_create` first to set up a project.",
              },
            },
          ],
        };
      }

      const result = await context.assemble(
        state.activeProjectId,
        state.activeThreadId
      );

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Here is the ThreadMind context for the active thread. Use this as your working context:\n\n${result.text}\n\n---\n_Estimated tokens: ~${result.tokens} | Thread depth: ${result.threadDepth}_`,
            },
          },
        ],
      };
    }
  );

  // --- summarize-thread ---
  server.prompt(
    "summarize-thread",
    "Generate a structured summary for the current thread. The AI will produce a summary that can be saved with summary_update.",
    {
      topic: z
        .string()
        .optional()
        .describe("Brief description of what was discussed (helps guide the summary)"),
    },
    async ({ topic }) => {
      const state = await storage.readConfig();
      const threadId = state.activeThreadId ?? "main";
      const projectId = state.activeProjectId;

      let currentSummary = "";
      if (projectId) {
        try {
          const node = await storage.readThread(projectId, threadId);
          currentSummary = node.content
            ? `\n\nCurrent summary (to update/replace):\n${node.content}`
            : "";
        } catch {
          // Thread may not exist yet
        }
      }

      const topicHint = topic
        ? `\nThe discussion was about: ${topic}`
        : "";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Please generate a concise summary (5-15 lines) for the current ThreadMind thread "${threadId}".${topicHint}${currentSummary}

The summary should capture:
- **Decisions made** and their rationale
- **Technical choices** and trade-offs considered
- **Current state** of the implementation
- **Open questions** or next steps (if any)

Format the summary as clean markdown. Focus on WHAT was decided and WHY — not on the conversation itself. The summary should be self-contained: a developer reading it with no prior context should understand the current state.

After generating the summary, call \`summary_update\` with the content to save it.`,
            },
          },
        ],
      };
    }
  );

  // ==========================================================================
  // Quick-action prompts (slash commands for every tool)
  // ==========================================================================

  // --- tm-help ---
  server.prompt(
    "tm-help",
    "Show all available ThreadMind commands and tools",
    {},
    async () => {
      const state = await storage.readConfig();
      let statusLine = "";
      if (state.activeProjectId) {
        statusLine = `\nActive project: **${state.activeProjectId}** | Active thread: **${state.activeThreadId ?? "main"}**\n`;
      }

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Show the user this ThreadMind command reference:${statusLine}

## ThreadMind Commands

### Quick shortcuts (type in chat)
| Shortcut | Action |
|----------|--------|
| \`tm:help\` | Show this help |
| \`tm:context\` | Load assembled context |
| \`tm:tree\` | Show thread tree |
| \`tm:create <title>\` | Create a new thread |
| \`tm:switch <id>\` | Switch to a thread |
| \`tm:summary <content>\` | Update thread summary |
| \`tm:stats\` | Show token savings statistics |
| \`tm:init\` | Generate instruction files |

### MCP Tools (called by AI)
| Tool | Description |
|------|-------------|
| \`project_create\` | Create a new project |
| \`project_list\` | List all projects |
| \`project_switch\` | Switch project |
| \`thread_create\` | Create child thread |
| \`thread_switch\` | Switch thread |
| \`thread_list\` | Show thread tree |
| \`thread_delete\` | Delete thread + descendants |
| \`summary_update\` | Update thread summary |
| \`context_get\` | Get assembled context |
| \`threadmind_init\` | Generate AI client instructions |
| \`stats_show\` | Token savings statistics |

### MCP Prompts (slash commands in Claude Code)
All prompts above are also available as \`/mcp__thread-mind__<name>\` in the slash command picker.`,
            },
          },
        ],
      };
    }
  );

  // --- tm-context ---
  server.prompt(
    "tm-context",
    "Get the assembled context for the active thread (shortcut for context_get)",
    {},
    async () => {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: "Call the `context_get` tool now and show me the assembled ThreadMind context.",
            },
          },
        ],
      };
    }
  );

  // --- tm-tree ---
  server.prompt(
    "tm-tree",
    "Display the thread tree for the active project (shortcut for thread_list)",
    {},
    async () => {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: "Call the `thread_list` tool now and display the thread tree.",
            },
          },
        ],
      };
    }
  );

  // --- tm-create ---
  server.prompt(
    "tm-create",
    "Create a new child thread (shortcut for thread_create)",
    {
      title: z.string().describe("Title for the new thread"),
    },
    async ({ title }) => {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Call the \`thread_create\` tool now with title "${title}".`,
            },
          },
        ],
      };
    }
  );

  // --- tm-switch ---
  server.prompt(
    "tm-switch",
    "Switch to a different thread (shortcut for thread_switch)",
    {
      threadId: z.string().describe("Thread ID to switch to"),
    },
    async ({ threadId }) => {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Call the \`thread_switch\` tool now with threadId "${threadId}".`,
            },
          },
        ],
      };
    }
  );

  // --- tm-summary ---
  server.prompt(
    "tm-summary",
    "Update the summary for the active thread (shortcut for summary_update)",
    {
      content: z
        .string()
        .optional()
        .describe("Summary content. If omitted, AI will generate one."),
    },
    async ({ content }) => {
      if (content) {
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Call the \`summary_update\` tool now with this content:\n\n${content}`,
              },
            },
          ],
        };
      }

      // No content provided — trigger summarize flow
      const state = await storage.readConfig();
      const threadId = state.activeThreadId ?? "main";

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Generate a concise summary (5-15 lines) of our current discussion for thread "${threadId}", then call \`summary_update\` to save it. Focus on decisions, technical choices, current state, and next steps.`,
            },
          },
        ],
      };
    }
  );

  // --- tm-stats ---
  server.prompt(
    "tm-stats",
    "Show token savings statistics (shortcut for stats_show)",
    {},
    async () => {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: "Call the `stats_show` tool now and display the token savings statistics.",
            },
          },
        ],
      };
    }
  );

  // --- tm-init ---
  server.prompt(
    "tm-init",
    "Generate instruction files for AI clients (shortcut for threadmind_init)",
    {},
    async () => {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: "Call the `threadmind_init` tool now to generate instruction files (CLAUDE.md, .cursorrules, etc.).",
            },
          },
        ],
      };
    }
  );
}
