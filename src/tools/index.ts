import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppState, Services } from "../types/index.js";
import {
  CLIENT_TARGETS,
  generateInstructions,
} from "../core/instructions.js";
import { ID_PATTERN, ID_PATTERN_MESSAGE } from "../core/ids.js";
import { formatContext } from "../core/context.js";
import { formatStatsReport } from "../core/stats.js";

const id = () => z.string().regex(ID_PATTERN, ID_PATTERN_MESSAGE);

// All tools work on local files only
const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;

export function registerTools(server: McpServer, services: Services): void {
  const { storage, project, thread, context, stats } = services;

  /** The local state, or an error that tells the model how to recover. */
  async function requireActiveProject(): Promise<
    AppState & { activeProjectId: string }
  > {
    const state = await storage.readConfig();
    if (state.activeProjectId) {
      return { ...state, activeProjectId: state.activeProjectId };
    }

    const projects = await storage.listProjects();
    if (projects.length > 0) {
      throw new Error(
        `No active project. Existing projects: ${projects.map((p) => p.id).join(", ")}. Use project_switch to select one.`
      );
    }
    throw new Error(
      "No ThreadMind project in this workspace. Only create one (project_create) if the user asks for it."
    );
  }

  // --- project_create ---
  server.registerTool(
    "project_create",
    {
      title: "Create project",
      description: "Create a new ThreadMind project with a main thread",
      inputSchema: {
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
      annotations: { ...WRITE, idempotentHint: false },
    },
    async ({ title, systemContext, mode }) => {
      try {
        const config = await project.create({ title, systemContext, mode });
        server.sendResourceListChanged();
        return textResult(
          `Project "${config.title}" created (id: ${config.id}, mode: ${config.mode}).\nMain thread created and set as active.\n\nClaude Code and other clients that read MCP server instructions need no further setup. For other agents, run \`threadmind_init\` to generate an AGENTS.md file.`
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- project_list ---
  server.registerTool(
    "project_list",
    {
      title: "List projects",
      description: "List all ThreadMind projects",
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const projects = await project.list();
        const state = await storage.readConfig();

        if (projects.length === 0) {
          return textResult(
            "No projects found. Use project_create to create one."
          );
        }

        const lines = projects.map((p) => {
          const active = p.id === state.activeProjectId ? " ← active" : "";
          return `- ${p.title} (${p.id}) [${p.mode}]${active}`;
        });
        return textResult(lines.join("\n"));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- project_switch ---
  server.registerTool(
    "project_switch",
    {
      title: "Switch project",
      description: "Switch to a different project",
      inputSchema: {
        projectId: id().describe("Project ID to switch to"),
      },
      annotations: { ...WRITE, idempotentHint: true },
    },
    async ({ projectId }) => {
      try {
        await project.switch(projectId);
        server.sendResourceListChanged();
        return textResult(
          `Switched to project "${projectId}". Active thread reset to "main".`
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- thread_create ---
  server.registerTool(
    "thread_create",
    {
      title: "Create thread",
      description:
        "Create a new child thread branching from a parent thread, and make it the active thread",
      inputSchema: {
        title: z.string().describe("Thread title"),
        parentId: id()
          .optional()
          .describe("Parent thread ID (defaults to current active thread)"),
      },
      annotations: { ...WRITE, idempotentHint: false },
    },
    async ({ title, parentId }) => {
      try {
        const state = await requireActiveProject();
        const resolvedParent = parentId ?? state.activeThreadId ?? "main";

        const node = await thread.create({
          projectId: state.activeProjectId,
          parentId: resolvedParent,
          title,
          author: await project.resolveAuthor(),
        });
        server.sendResourceListChanged();

        const treeView = await thread.list(state.activeProjectId);

        // Warn if the parent thread has no summary yet
        let summaryWarning = "";
        try {
          const parentNode = await storage.readThread(
            state.activeProjectId,
            resolvedParent
          );
          if (!parentNode.content) {
            summaryWarning =
              `\n\n⚠️  Parent thread "${resolvedParent}" has no summary yet.` +
              `\nRun \`tm:summary\` on "${resolvedParent}" before continuing — ` +
              `this ensures the context chain is complete when you call \`context_get\` from child threads.`;
          }
        } catch {
          // Parent read failed — skip warning silently
        }

        return textResult(
          `Thread "${node.metadata.id}" created under "${resolvedParent}".\n\n${treeView}${summaryWarning}`
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- thread_switch ---
  server.registerTool(
    "thread_switch",
    {
      title: "Switch thread",
      description:
        "Switch to a different thread and return its assembled context (no need to call context_get afterwards)",
      inputSchema: {
        threadId: id().describe("Thread ID to switch to"),
      },
      annotations: { ...WRITE, idempotentHint: true },
    },
    async ({ threadId }) => {
      try {
        const state = await requireActiveProject();
        await thread.switch(state.activeProjectId, threadId);
        const result = await context.assemble(state.activeProjectId, threadId);

        return textResult(
          `Switched to thread "${threadId}".\n\n${formatContext(result)}`
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- thread_list ---
  server.registerTool(
    "thread_list",
    {
      title: "Show thread tree",
      description: "Display the thread tree for the active project",
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const state = await requireActiveProject();
        return textResult(await thread.list(state.activeProjectId));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- summary_update ---
  server.registerTool(
    "summary_update",
    {
      title: "Update thread summary",
      description:
        "Replace the summary of a thread (markdown). Keep what is still true from the previous summary.",
      inputSchema: {
        content: z.string().describe("The new summary content (markdown)"),
        threadId: id()
          .optional()
          .describe("Thread ID to update (defaults to active thread)"),
      },
      annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
    },
    async ({ content, threadId }) => {
      try {
        const state = await requireActiveProject();
        const resolvedThread = threadId ?? state.activeThreadId ?? "main";
        const projectConfig = await storage.readProjectConfig(
          state.activeProjectId
        );

        await thread.updateSummary({
          projectId: state.activeProjectId,
          threadId: resolvedThread,
          content,
          author: await project.resolveAuthor(),
          mode: projectConfig.mode,
        });

        // Track stats for token savings estimation
        await stats.recordUpdate(
          state.activeProjectId,
          resolvedThread,
          content
        );

        return textResult(`Summary updated for thread "${resolvedThread}".`);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- context_get ---
  server.registerTool(
    "context_get",
    {
      title: "Get thread context",
      description:
        "Get the assembled context of the active thread: the chain of summaries from the root down to it. Call it once at the start of a session.",
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const state = await requireActiveProject();
        const result = await context.assemble(
          state.activeProjectId,
          state.activeThreadId ?? "main"
        );
        const projectStats = await stats.getProjectStats(
          state.activeProjectId
        );

        return textResult(formatContext(result, projectStats));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- thread_delete ---
  server.registerTool(
    "thread_delete",
    {
      title: "Delete thread",
      description: "Delete a thread and all its descendants",
      inputSchema: {
        threadId: id().describe("Thread ID to delete"),
      },
      annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
    },
    async ({ threadId }) => {
      try {
        const state = await requireActiveProject();
        const projectConfig = await storage.readProjectConfig(
          state.activeProjectId
        );

        await thread.delete({
          projectId: state.activeProjectId,
          threadId,
          author: await project.resolveAuthor(),
          mode: projectConfig.mode,
        });
        server.sendResourceListChanged();

        const treeView = await thread.list(state.activeProjectId);
        return textResult(
          `Thread "${threadId}" and its descendants deleted.\n\n${treeView}`
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- thread_rebase ---
  server.registerTool(
    "thread_rebase",
    {
      title: "Move thread",
      description:
        "Move a thread to a different parent. All descendants move with it. Similar to git rebase.",
      inputSchema: {
        threadId: id().describe("ID of the thread to move"),
        newParentId: id().describe("ID of the new parent thread"),
      },
      annotations: { ...WRITE, idempotentHint: true },
    },
    async ({ threadId, newParentId }) => {
      try {
        const state = await requireActiveProject();
        const projectConfig = await storage.readProjectConfig(
          state.activeProjectId
        );

        await thread.rebase({
          projectId: state.activeProjectId,
          threadId,
          newParentId,
          author: await project.resolveAuthor(),
          mode: projectConfig.mode,
        });

        const treeView = await thread.list(state.activeProjectId);
        return textResult(
          `Thread "${threadId}" moved under "${newParentId}".\n\n${treeView}`
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- threadmind_init ---
  server.registerTool(
    "threadmind_init",
    {
      title: "Generate instruction files",
      description:
        "Write ThreadMind usage instructions into the files AI agents read. Claude Code doesn't need them: it receives these instructions from this server.",
      inputSchema: {
        clients: z
          .array(z.enum(CLIENT_TARGETS))
          .optional()
          .describe(
            'Files to generate: "agents" (AGENTS.md, read by Codex, Cursor, Copilot and others), "claude" (CLAUDE.md), "cursor" (.cursor/rules/threadmind.mdc), "generic" (.threadmind/instructions.md, to paste into any client). Default: agents and generic.'
          ),
      },
      annotations: { ...WRITE, idempotentHint: true },
    },
    async ({ clients }) => {
      try {
        const state = await requireActiveProject();
        const projectConfig = await storage.readProjectConfig(
          state.activeProjectId
        );

        const result = await generateInstructions({
          projectTitle: projectConfig.title,
          basePath: await storage.workspaceRoot(),
          clients,
        });

        const fileList = result.files
          .map((f) => {
            const note =
              f.action === "created"
                ? "created"
                : f.client === "cursor"
                ? "updated"
                : `${f.action} — existing content preserved`;
            return `  - ${f.client}: ${f.path} (${note})`;
          })
          .join("\n");
        const notes =
          result.notes.length > 0
            ? `\n\nNotes:\n${result.notes.map((n) => `  - ${n}`).join("\n")}`
            : "";

        return textResult(
          `Instruction files generated:\n${fileList}${notes}\n\nIn Markdown files, the ThreadMind section is delimited by <!-- threadmind:start/end --> markers.\nRe-run threadmind_init at any time to update it without affecting your other content.`
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- stats_show ---
  server.registerTool(
    "stats_show",
    {
      title: "Show token statistics",
      description:
        "Show token savings statistics for the active ThreadMind project",
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const state = await requireActiveProject();
        const projectConfig = await storage.readProjectConfig(
          state.activeProjectId
        );
        const projectStats = await stats.getProjectStats(
          state.activeProjectId
        );
        const result = await context.assemble(
          state.activeProjectId,
          state.activeThreadId ?? "main"
        );
        const tree = await storage.readTree(state.activeProjectId);

        return textResult(
          formatStatsReport({
            projectTitle: projectConfig.title,
            stats: projectStats,
            threadCount: Object.keys(tree.nodes).length,
            context: result,
          })
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}
