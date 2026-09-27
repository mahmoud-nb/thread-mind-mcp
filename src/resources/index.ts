import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Services } from "../types/index.js";
import { formatContext } from "../core/context.js";
import { completeThreadIds } from "../core/thread.js";

export function registerResources(
  server: McpServer,
  services: Services
): void {
  const { storage, thread, context } = services;

  // --- threadmind://context ---
  server.registerResource(
    "current-context",
    "threadmind://context",
    {
      title: "Active thread context",
      description:
        "The assembled context for the active thread (walks up the parent chain)",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const state = await storage.readConfig();
      if (!state.activeProjectId) {
        return plainText(
          uri,
          "No active project or thread. Use project_create first."
        );
      }

      const result = await context.assemble(
        state.activeProjectId,
        state.activeThreadId ?? "main"
      );

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: formatContext(result),
          },
        ],
      };
    }
  );

  // --- threadmind://tree ---
  server.registerResource(
    "thread-tree",
    "threadmind://tree",
    {
      title: "Thread tree",
      description: "Thread tree visualization for the active project",
      mimeType: "text/plain",
    },
    async (uri) => {
      const state = await storage.readConfig();
      if (!state.activeProjectId) {
        return plainText(uri, "No active project. Use project_create first.");
      }

      return plainText(uri, await thread.list(state.activeProjectId));
    }
  );

  // --- threadmind://thread/{threadId} ---
  server.registerResource(
    "thread",
    new ResourceTemplate("threadmind://thread/{threadId}", {
      list: async () => {
        const state = await storage.readConfig();
        if (!state.activeProjectId) return { resources: [] };

        const projectId = state.activeProjectId;
        const tree = await storage.readTree(projectId);
        const resources = await Promise.all(
          Object.keys(tree.nodes).map(async (threadId) => {
            let title = threadId;
            try {
              const node = await storage.readThread(projectId, threadId);
              title = node.metadata.title || threadId;
            } catch {
              // Missing thread file: list it by ID
            }
            return {
              uri: `threadmind://thread/${threadId}`,
              name: threadId,
              title,
              mimeType: "text/markdown",
            };
          })
        );
        return { resources };
      },
      complete: {
        threadId: (value) => completeThreadIds(storage, value),
      },
    }),
    {
      title: "Thread summary",
      description:
        "The summary of one thread of the active project, without its ancestors",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const state = await storage.readConfig();
      if (!state.activeProjectId) {
        throw new Error("No active ThreadMind project");
      }

      const raw = variables["threadId"];
      const threadId = Array.isArray(raw) ? raw[0] : raw;
      const tree = await storage.readTree(state.activeProjectId);
      if (!threadId || !tree.nodes[threadId]) {
        throw new Error(`Thread "${threadId}" not found`);
      }

      const node = await storage.readThread(state.activeProjectId, threadId);
      const { title, parentId, author, updatedAt } = node.metadata;
      const text =
        `# ${title}\n\n` +
        `_Thread \`${threadId}\` · parent: ${parentId ?? "none"} · author: ${author || "unknown"} · updated: ${updatedAt || "never"}_\n\n` +
        (node.content || "(No summary yet.)");

      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text }],
      };
    }
  );
}

function plainText(uri: URL, text: string) {
  return {
    contents: [{ uri: uri.href, mimeType: "text/plain", text }],
  };
}
