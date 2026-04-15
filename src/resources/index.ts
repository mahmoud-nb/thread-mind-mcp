import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Services } from "../types/index.js";

export function registerResources(
  server: McpServer,
  services: Services
): void {
  const { storage, thread, context } = services;

  // --- threadmind://context ---
  server.resource(
    "current-context",
    "threadmind://context",
    {
      description:
        "The assembled context for the active thread (walks up the parent chain)",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const state = await storage.readConfig();
      if (!state.activeProjectId || !state.activeThreadId) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: "No active project or thread. Use project_create first.",
            },
          ],
        };
      }

      const result = await context.assemble(
        state.activeProjectId,
        state.activeThreadId
      );

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: `${result.text}\n\n---\n_~${result.tokens} tokens | depth: ${result.threadDepth}_`,
          },
        ],
      };
    }
  );

  // --- threadmind://tree ---
  server.resource(
    "thread-tree",
    "threadmind://tree",
    {
      description: "Thread tree visualization for the active project",
      mimeType: "text/plain",
    },
    async (uri) => {
      const state = await storage.readConfig();
      if (!state.activeProjectId) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: "No active project. Use project_create first.",
            },
          ],
        };
      }

      const tree = await thread.list(state.activeProjectId);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: tree,
          },
        ],
      };
    }
  );
}
