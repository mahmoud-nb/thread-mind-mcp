import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ActiveThread, Services } from "../types/index.js";
import {
  CLIENT_TARGETS,
  generateInstructions,
} from "../core/instructions.js";
import { ID_PATTERN, ID_PATTERN_MESSAGE } from "../core/ids.js";
import { formatContext } from "../core/context.js";
import { formatStatsReport } from "../core/stats.js";
import { SECTIONS } from "../core/summary.js";
import { headCommit } from "../core/git.js";

const id = () => z.string().regex(ID_PATTERN, ID_PATTERN_MESSAGE);

const maxTokens = () =>
  z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Token budget: the farthest ancestors are left out first to fit it"
    );

// All tools work on local files only
const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;

export function registerTools(server: McpServer, services: Services): void {
  const { storage, project, thread, context, stats, session } = services;

  /** The session's project and thread, or an error telling the model how to recover. */
  async function requireActive(): Promise<ActiveThread> {
    const active = await session.active();
    if (active) return active;

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

  async function projectMode(projectId: string): Promise<"solo" | "team"> {
    return (await project.get(projectId)).mode;
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
        await session.selectProject(config.id);
        await session.selectThread(config.id, "main");
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
        if (projects.length === 0) {
          return textResult(
            "No projects found. Use project_create to create one."
          );
        }

        const active = await session.active();
        const lines = projects.map((p) => {
          const marker = p.id === active?.projectId ? " ← active" : "";
          return `- ${p.title} (${p.id}) [${p.mode}]${marker}`;
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
        await project.get(projectId);
        await session.selectProject(projectId);
        server.sendResourceListChanged();

        const active = await session.active();
        return textResult(
          `Switched to project "${projectId}". Active thread: "${active?.threadId ?? "main"}".`
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
        "Create a new child thread branching from a parent thread, and make it the active thread. On a feature branch, the thread is linked to that branch.",
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
        const active = await requireActive();
        const resolvedParent = parentId ?? active.threadId;
        const branch = await session.branchToLink(active.projectId);

        const node = await thread.create({
          projectId: active.projectId,
          parentId: resolvedParent,
          title,
          author: await project.resolveAuthor(),
          branch: branch ?? undefined,
        });
        await session.selectThread(active.projectId, node.metadata.id);
        server.sendResourceListChanged();

        const treeView = await thread.list(active.projectId, node.metadata.id);
        const linked = branch
          ? `\nLinked to git branch "${branch}": it becomes the active thread whenever this branch is checked out.`
          : "";

        // Warn if the parent thread has no summary yet
        let summaryWarning = "";
        try {
          const parentNode = await storage.readThread(
            active.projectId,
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
          `Thread "${node.metadata.id}" created under "${resolvedParent}".${linked}\n\n${treeView}${summaryWarning}`
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
        "Switch this session to a different thread and return its assembled context (no need to call context_get afterwards)",
      inputSchema: {
        threadId: id().describe("Thread ID to switch to"),
        maxTokens: maxTokens(),
      },
      annotations: { ...WRITE, idempotentHint: true },
    },
    async ({ threadId, maxTokens }) => {
      try {
        const active = await requireActive();
        await session.selectThread(active.projectId, threadId);
        const result = await context.assemble(active.projectId, threadId, {
          maxTokens,
        });

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
      description:
        "Display the thread tree for the active project, with each thread's status and linked branch",
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const active = await requireActive();
        return textResult(await thread.list(active.projectId, active.threadId));
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
        "Update the summary of a thread (markdown). With a section, adds to that section only (or replaces it with replaceSection); without one, replaces the whole summary, so keep what is still true.",
      inputSchema: {
        content: z
          .string()
          .describe(
            "The new summary, or the text to add to the section (markdown)"
          ),
        threadId: id()
          .optional()
          .describe("Thread ID to update (defaults to active thread)"),
        section: z
          .enum(SECTIONS)
          .optional()
          .describe(
            "Only update this section: decisions, constraints, state, open-questions or next-steps"
          ),
        replaceSection: z
          .boolean()
          .optional()
          .describe(
            "Replace the section instead of adding to it (use it for state and next-steps)"
          ),
        paths: z
          .array(z.string())
          .optional()
          .describe(
            "Files or directories this thread is about, used to flag the summary when they change"
          ),
      },
      annotations: { ...WRITE, destructiveHint: true, idempotentHint: false },
    },
    async ({ content, threadId, section, replaceSection, paths }) => {
      try {
        const active = await requireActive();
        const resolvedThread = threadId ?? active.threadId;

        await thread.updateSummary({
          projectId: active.projectId,
          threadId: resolvedThread,
          content,
          author: await project.resolveAuthor(),
          mode: await projectMode(active.projectId),
          section,
          replaceSection,
          commit: (await headCommit(await storage.workspaceRoot())) ?? undefined,
          paths,
        });

        const what = section ? `Section "${section}" of the summary` : "Summary";
        return textResult(`${what} updated for thread "${resolvedThread}".`);
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
        "Get the assembled context of the active thread: its summary plus the decisions and constraints of its ancestors. Call it once at the start of a session.",
      inputSchema: {
        maxTokens: maxTokens(),
      },
      annotations: READ_ONLY,
    },
    async ({ maxTokens }) => {
      try {
        const active = await requireActive();
        const result = await context.assemble(
          active.projectId,
          active.threadId,
          { maxTokens }
        );
        return textResult(formatContext(result));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- thread_status ---
  server.registerTool(
    "thread_status",
    {
      title: "Set thread status",
      description:
        "Mark a thread as done or abandoned (or active again). The reason is added to the thread's decisions, so the outcome stays on record.",
      inputSchema: {
        status: z
          .enum(["active", "done", "abandoned"])
          .describe("New status"),
        threadId: id()
          .optional()
          .describe("Thread ID (defaults to active thread)"),
        reason: z
          .string()
          .optional()
          .describe("Why the thread is done or abandoned"),
      },
      annotations: { ...WRITE, idempotentHint: true },
    },
    async ({ status, threadId, reason }) => {
      try {
        const active = await requireActive();
        const resolvedThread = threadId ?? active.threadId;

        await thread.setStatus({
          projectId: active.projectId,
          threadId: resolvedThread,
          status,
          reason,
          author: await project.resolveAuthor(),
          mode: await projectMode(active.projectId),
        });

        const treeView = await thread.list(active.projectId, active.threadId);
        return textResult(
          `Thread "${resolvedThread}" is now ${status}.\n\n${treeView}`
        );
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // --- thread_merge ---
  server.registerTool(
    "thread_merge",
    {
      title: "Merge thread into parent",
      description:
        "Fold a finished thread into its parent: replaces the parent's summary with parentSummary, marks the thread done and switches to the parent. Write parentSummary yourself, including the thread's conclusions.",
      inputSchema: {
        parentSummary: z
          .string()
          .describe(
            "The parent's new summary, including the merged thread's conclusions (markdown)"
          ),
        threadId: id()
          .optional()
          .describe("Thread ID to merge (defaults to active thread)"),
      },
      annotations: { ...WRITE, destructiveHint: true, idempotentHint: false },
    },
    async ({ parentSummary, threadId }) => {
      try {
        const active = await requireActive();
        const resolvedThread = threadId ?? active.threadId;

        const { parentId } = await thread.merge({
          projectId: active.projectId,
          threadId: resolvedThread,
          parentSummary,
          author: await project.resolveAuthor(),
          mode: await projectMode(active.projectId),
          commit: (await headCommit(await storage.workspaceRoot())) ?? undefined,
        });
        await session.selectThread(active.projectId, parentId);

        const treeView = await thread.list(active.projectId, parentId);
        return textResult(
          `Thread "${resolvedThread}" merged into "${parentId}", which is now the active thread.\n\n${treeView}`
        );
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
        const active = await requireActive();

        await thread.delete({
          projectId: active.projectId,
          threadId,
          author: await project.resolveAuthor(),
          mode: await projectMode(active.projectId),
        });
        server.sendResourceListChanged();

        const current = await session.active();
        const treeView = await thread.list(
          active.projectId,
          current?.threadId ?? null
        );
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
        const active = await requireActive();

        await thread.rebase({
          projectId: active.projectId,
          threadId,
          newParentId,
          author: await project.resolveAuthor(),
          mode: await projectMode(active.projectId),
        });

        const treeView = await thread.list(active.projectId, active.threadId);
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
        const active = await requireActive();
        const projectConfig = await project.get(active.projectId);

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
      title: "Show statistics",
      description:
        "Show the size of each summary and, with the Claude Code plugin, measured conversation sizes",
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const active = await requireActive();
        const projectConfig = await project.get(active.projectId);
        const result = await context.assemble(
          active.projectId,
          active.threadId
        );

        return textResult(
          formatStatsReport({
            projectTitle: projectConfig.title,
            threads: await storage.listThreads(active.projectId),
            activeThreadId: active.threadId,
            context: result,
            sessions: await stats.sessions(),
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
