import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Services } from "../types/index.js";
import {
  generateInstructions,
  type ClientTarget,
} from "../core/instructions.js";

export function registerTools(server: McpServer, services: Services): void {
  const { storage, project, thread, context, stats } = services;

  // --- project_create ---
  server.tool(
    "project_create",
    "Create a new ThreadMind project with a main thread",
    {
      title: z.string().describe("Project title"),
      systemContext: z
        .string()
        .optional()
        .describe("System context or instructions for this project"),
      mode: z
        .enum(["solo", "team"])
        .optional()
        .describe("Project mode: solo (default) or team"),
    },
    async ({ title, systemContext, mode }) => {
      try {
        const config = await project.create({ title, systemContext, mode });
        return {
          content: [
            {
              type: "text" as const,
              text: `Project "${config.title}" created (id: ${config.id}, mode: ${config.mode}).\nMain thread created and set as active.\n\nTip: Run \`threadmind_init\` to generate instruction files (CLAUDE.md, .cursorrules) for automatic context integration.`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- project_list ---
  server.tool(
    "project_list",
    "List all ThreadMind projects",
    {},
    async () => {
      try {
        await storage.ensureInitialized();
        const projects = await project.list();
        const state = await storage.readConfig();

        if (projects.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No projects found. Use project_create to create one.",
              },
            ],
          };
        }

        const lines = projects.map((p) => {
          const active = p.id === state.activeProjectId ? " ← active" : "";
          return `- ${p.title} (${p.id}) [${p.mode}]${active}`;
        });

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- project_switch ---
  server.tool(
    "project_switch",
    "Switch to a different project",
    {
      projectId: z.string().describe("Project ID to switch to"),
    },
    async ({ projectId }) => {
      try {
        await project.switch(projectId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Switched to project "${projectId}". Active thread reset to "main".`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- thread_create ---
  server.tool(
    "thread_create",
    "Create a new child thread branching from a parent thread",
    {
      title: z.string().describe("Thread title"),
      parentId: z
        .string()
        .optional()
        .describe("Parent thread ID (defaults to current active thread)"),
    },
    async ({ title, parentId }) => {
      try {
        const state = await storage.readConfig();
        if (!state.activeProjectId) {
          throw new Error("No active project. Use project_create first.");
        }

        const resolvedParent =
          parentId ?? state.activeThreadId ?? "main";

        const node = await thread.create({
          projectId: state.activeProjectId,
          parentId: resolvedParent,
          title,
          author: state.author,
        });

        const treeView = await thread.list(state.activeProjectId);

        return {
          content: [
            {
              type: "text" as const,
              text: `Thread "${node.metadata.id}" created under "${resolvedParent}".\n\n${treeView}`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- thread_switch ---
  server.tool(
    "thread_switch",
    "Switch to a different thread",
    {
      threadId: z.string().describe("Thread ID to switch to"),
    },
    async ({ threadId }) => {
      try {
        const state = await storage.readConfig();
        if (!state.activeProjectId) {
          throw new Error("No active project. Use project_create first.");
        }

        await thread.switch(state.activeProjectId, threadId);
        const result = await context.assemble(
          state.activeProjectId,
          threadId
        );

        const preview =
          result.text.length > 300
            ? result.text.slice(0, 300) + "..."
            : result.text;

        return {
          content: [
            {
              type: "text" as const,
              text: `Switched to thread "${threadId}".\n\nContext preview (~${result.tokens} tokens):\n${preview}`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- thread_list ---
  server.tool(
    "thread_list",
    "Display the thread tree for the active project",
    {},
    async () => {
      try {
        const state = await storage.readConfig();
        if (!state.activeProjectId) {
          throw new Error("No active project. Use project_create first.");
        }

        const treeView = await thread.list(state.activeProjectId);
        return {
          content: [{ type: "text" as const, text: treeView }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- summary_update ---
  server.tool(
    "summary_update",
    "Update the summary/content of a thread",
    {
      content: z.string().describe("The new summary content (markdown)"),
      threadId: z
        .string()
        .optional()
        .describe("Thread ID to update (defaults to active thread)"),
    },
    async ({ content, threadId }) => {
      try {
        const state = await storage.readConfig();
        if (!state.activeProjectId) {
          throw new Error("No active project. Use project_create first.");
        }

        const resolvedThread =
          threadId ?? state.activeThreadId ?? "main";
        const projectConfig = await storage.readProjectConfig(
          state.activeProjectId
        );

        await thread.updateSummary({
          projectId: state.activeProjectId,
          threadId: resolvedThread,
          content,
          author: state.author,
          mode: projectConfig.mode,
        });

        // Track stats for token savings estimation
        await stats.recordUpdate(
          state.activeProjectId,
          resolvedThread,
          content
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Summary updated for thread "${resolvedThread}".`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- context_get ---
  server.tool(
    "context_get",
    "Get the assembled context for the active thread (walks up the parent chain). Call this at the start of every session.",
    {},
    async () => {
      try {
        const state = await storage.readConfig();
        if (!state.activeProjectId || !state.activeThreadId) {
          throw new Error(
            "No active project/thread. Use project_create first."
          );
        }

        const result = await context.assemble(
          state.activeProjectId,
          state.activeThreadId
        );

        // Build footer with token comparison if stats exist
        const projectStats = await stats.getProjectStats(
          state.activeProjectId
        );
        let footer = `_ThreadMind context: ~${result.tokens} tokens | depth: ${result.threadDepth} threads_`;

        const totalCumulativeChars = Object.values(
          projectStats.threads
        ).reduce((sum, s) => sum + s.cumulativeInputLength, 0);
        const totalUpdates = Object.values(projectStats.threads).reduce(
          (sum, s) => sum + s.updateCount,
          0
        );

        if (totalCumulativeChars > 0) {
          const estimatedRawTokens = Math.ceil(
            totalCumulativeChars / 3.5
          );
          const reduction = Math.round(
            (1 - result.tokens / estimatedRawTokens) * 100
          );
          footer += `\n_Estimated raw history: ~${estimatedRawTokens.toLocaleString()} tokens (~${reduction}% reduction from ${totalUpdates} summary updates)_`;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `${result.text}\n\n---\n${footer}`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- thread_delete ---
  server.tool(
    "thread_delete",
    "Delete a thread and all its descendants",
    {
      threadId: z.string().describe("Thread ID to delete"),
    },
    async ({ threadId }) => {
      try {
        const state = await storage.readConfig();
        if (!state.activeProjectId) {
          throw new Error("No active project. Use project_create first.");
        }

        const projectConfig = await storage.readProjectConfig(
          state.activeProjectId
        );

        await thread.delete({
          projectId: state.activeProjectId,
          threadId,
          author: state.author,
          mode: projectConfig.mode,
        });

        const treeView = await thread.list(state.activeProjectId);

        return {
          content: [
            {
              type: "text" as const,
              text: `Thread "${threadId}" and its descendants deleted.\n\n${treeView}`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- threadmind_init ---
  server.tool(
    "threadmind_init",
    "Generate instruction files (CLAUDE.md, .cursorrules, etc.) to enable automatic ThreadMind integration with AI clients",
    {
      clients: z
        .array(z.enum(["claude", "cursor", "generic"]))
        .optional()
        .describe(
          'AI clients to generate instructions for (default: all). Options: "claude", "cursor", "generic"'
        ),
    },
    async ({ clients }) => {
      try {
        const state = await storage.readConfig();
        if (!state.activeProjectId) {
          throw new Error("No active project. Use project_create first.");
        }

        const projectConfig = await storage.readProjectConfig(
          state.activeProjectId
        );

        const result = await generateInstructions({
          projectTitle: projectConfig.title,
          basePath: process.cwd(),
          clients: clients as ClientTarget[] | undefined,
        });

        const fileList = result.files
          .map((f) => `  - ${f.client}: ${f.path}`)
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Instruction files generated:\n${fileList}\n\nThese files instruct AI clients to automatically use ThreadMind context management.`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- stats_show ---
  server.tool(
    "stats_show",
    "Show token savings statistics for the active ThreadMind project",
    {},
    async () => {
      try {
        const state = await storage.readConfig();
        if (!state.activeProjectId || !state.activeThreadId) {
          throw new Error(
            "No active project/thread. Use project_create first."
          );
        }

        const projectConfig = await storage.readProjectConfig(
          state.activeProjectId
        );
        const projectStats = await stats.getProjectStats(
          state.activeProjectId
        );
        const result = await context.assemble(
          state.activeProjectId,
          state.activeThreadId
        );
        const tree = await storage.readTree(state.activeProjectId);

        const totalThreads = Object.keys(tree.nodes).length;
        const threadsWithStats = Object.keys(projectStats.threads).length;
        const totalUpdates = Object.values(projectStats.threads).reduce(
          (sum, s) => sum + s.updateCount,
          0
        );
        const totalCumulativeChars = Object.values(
          projectStats.threads
        ).reduce((sum, s) => sum + s.cumulativeInputLength, 0);
        const estimatedRawTokens = Math.ceil(totalCumulativeChars / 3.5);
        const reduction =
          estimatedRawTokens > 0
            ? Math.round(
                (1 - result.tokens / estimatedRawTokens) * 100
              )
            : 0;

        // Build per-thread breakdown
        const perThreadLines: string[] = [];
        for (const [threadId, threadStats] of Object.entries(
          projectStats.threads
        )) {
          const currentTk = Math.ceil(
            threadStats.currentContentLength / 3.5
          );
          const cumulativeTk = Math.ceil(
            threadStats.cumulativeInputLength / 3.5
          );
          const ratio =
            cumulativeTk > 0
              ? Math.round((1 - currentTk / cumulativeTk) * 100)
              : 0;
          perThreadLines.push(
            `  ${threadId.padEnd(20)} ${String(threadStats.updateCount).padEnd(9)} ~${String(currentTk).padEnd(9)} ~${String(cumulativeTk).padEnd(13)} ${ratio}%`
          );
        }

        let output = `ThreadMind Stats: "${projectConfig.title}"\n\n`;
        output += `Overview:\n`;
        output += `  Threads: ${totalThreads} (${threadsWithStats} with tracked updates)\n`;
        output += `  Summary updates: ${totalUpdates}\n`;
        output += `  Current context: ~${result.tokens} tokens (depth: ${result.threadDepth})\n\n`;

        if (estimatedRawTokens > 0) {
          output += `Token Savings (estimated):\n`;
          output += `  Estimated raw history: ~${estimatedRawTokens.toLocaleString()} tokens\n`;
          output += `  ThreadMind context:    ~${result.tokens} tokens\n`;
          output += `  Reduction:             ~${reduction}%\n\n`;
        } else {
          output += `Token Savings:\n`;
          output += `  No summary updates tracked yet. Use summary_update to start tracking.\n\n`;
        }

        if (perThreadLines.length > 0) {
          output += `Per-Thread Breakdown:\n`;
          output += `  ${"Thread".padEnd(20)} ${"Updates".padEnd(9)} ${"Current".padEnd(10)} ${"Cumulative".padEnd(14)} Ratio\n`;
          output += perThreadLines.join("\n") + "\n\n";
        }

        output += `Method: Cumulative summary input vs current context size.\n`;
        output += `Token estimates use ~3.5 chars/token approximation.`;

        return {
          content: [{ type: "text" as const, text: output }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}
