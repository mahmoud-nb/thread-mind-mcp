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
  const { storage, thread, context, session } = services;

  // --- threadmind://context ---
  server.registerResource(
    "current-context",
    "threadmind://context",
    {
      title: "Active thread context",
      description:
        "The assembled context for the active thread: its summary plus the decisions and constraints of its ancestors",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const active = await session.active();
      if (!active) {
        return plainText(
          uri,
          "No active project or thread. Use project_create first."
        );
      }

      const result = await context.assemble(active.projectId, active.threadId);
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
      const active = await session.active();
      if (!active) {
        return plainText(uri, "No active project. Use project_create first.");
      }

      return plainText(
        uri,
        await thread.list(active.projectId, active.threadId)
      );
    }
  );

  // --- threadmind://thread/{threadId} ---
  server.registerResource(
    "thread",
    new ResourceTemplate("threadmind://thread/{threadId}", {
      list: async () => {
        const active = await session.active();
        if (!active) return { resources: [] };

        const threads = await storage.listThreads(active.projectId);
        return {
          resources: threads.map(({ metadata }) => ({
            uri: `threadmind://thread/${metadata.id}`,
            name: metadata.id,
            title: metadata.title || metadata.id,
            mimeType: "text/markdown",
          })),
        };
      },
      complete: {
        threadId: (value) => completeThreadIds(storage, session, value),
      },
    }),
    {
      title: "Thread summary",
      description:
        "The summary of one thread of the active project, without its ancestors",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const active = await session.active();
      if (!active) {
        throw new Error("No active ThreadMind project");
      }

      const raw = variables["threadId"];
      const threadId = Array.isArray(raw) ? raw[0] : raw;
      if (
        !threadId ||
        !(await storage.threadExists(active.projectId, threadId).catch(() => false))
      ) {
        throw new Error(`Thread "${threadId}" not found`);
      }

      const { metadata, content } = await storage.readThread(
        active.projectId,
        threadId
      );
      const details = [
        `Thread \`${threadId}\``,
        `parent: ${metadata.parentId ?? "none"}`,
        metadata.status ? `status: ${metadata.status}` : null,
        metadata.branch ? `branch: ${metadata.branch}` : null,
        `author: ${metadata.author || "unknown"}`,
        `updated: ${metadata.updatedAt || "never"}`,
        metadata.paths ? `paths: ${metadata.paths.join(", ")}` : null,
      ].filter(Boolean);
      const text =
        `# ${metadata.title}\n\n_${details.join(" · ")}_\n\n` +
        (content || "(No summary yet.)");

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
