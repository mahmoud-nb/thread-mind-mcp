import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Services } from "../types/index.js";

export function registerPrompts(
  server: McpServer,
  services: Services
): void {
  const { storage, context } = services;

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
}
