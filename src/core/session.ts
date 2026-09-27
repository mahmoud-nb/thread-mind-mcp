import { currentBranch, isBaseBranch } from "./git.js";
import type {
  ActiveThread,
  AppState,
  SessionService,
  StorageService,
  ThreadNode,
} from "../types/index.js";

/**
 * The active project and thread of one MCP session. Each client session runs
 * its own server process, so switching threads in one session doesn't move
 * the others; the last choice is saved as the starting point of later
 * sessions, per git branch.
 */
export class SessionServiceImpl implements SessionService {
  private projectId: string | null = null;
  private pinned: ActiveThread | null = null;

  constructor(private storage: StorageService) {}

  async active(): Promise<ActiveThread | null> {
    const state = await this.storage.readConfig();
    const projectId =
      this.projectId ?? state.activeProjectId ?? (await this.onlyProject());
    if (!projectId) return null;

    const threads = await this.storage.listThreads(projectId);
    if (threads.length === 0) return null;
    const byId = new Map(threads.map((t) => [t.metadata.id, t]));
    const branch = await currentBranch(await this.storage.workspaceRoot());

    // Keep the session's thread until the branch changes
    const pinned = this.pinned;
    if (
      pinned &&
      pinned.projectId === projectId &&
      pinned.branch === branch &&
      byId.has(pinned.threadId)
    ) {
      return pinned;
    }

    this.pinned = {
      projectId,
      branch,
      ...resolveThread(state, projectId, branch, byId),
    };
    return this.pinned;
  }

  async selectProject(projectId: string): Promise<void> {
    this.projectId = projectId;
    this.pinned = null;
    await this.storage.withLock(async () => {
      const state = await this.storage.readConfig();
      await this.storage.writeConfig({
        ...state,
        activeProjectId: projectId,
        activeThreadId: null,
      });
    });
  }

  async selectThread(projectId: string, threadId: string): Promise<void> {
    if (!(await this.storage.threadExists(projectId, threadId))) {
      throw new Error(`Thread "${threadId}" not found`);
    }
    const branch = await currentBranch(await this.storage.workspaceRoot());
    this.projectId = projectId;
    this.pinned = { projectId, threadId, branch, reason: "session" };

    await this.storage.withLock(async () => {
      const state = await this.storage.readConfig();
      const branchThreads = { ...state.branchThreads };
      if (branch) {
        branchThreads[projectId] = {
          ...branchThreads[projectId],
          [branch]: threadId,
        };
      }
      await this.storage.writeConfig({
        ...state,
        activeProjectId: projectId,
        activeThreadId: threadId,
        branchThreads,
      });
    });
  }

  /** A repository with a single project needs no selection, e.g. after a fresh clone. */
  private async onlyProject(): Promise<string | null> {
    const projects = await this.storage.listProjects();
    return projects.length === 1 ? projects[0].id : null;
  }

  async branchToLink(projectId: string): Promise<string | null> {
    const root = await this.storage.workspaceRoot();
    const branch = await currentBranch(root);
    if (!branch || (await isBaseBranch(root, branch))) return null;

    const threads = await this.storage.listThreads(projectId);
    const taken = threads.some(
      (t) => t.metadata.branch === branch && !t.metadata.status
    );
    return taken ? null : branch;
  }
}

/**
 * Where a session starts: the last thread used on this branch, else the open
 * thread linked to it, else the last thread used (unless it belongs to
 * another branch), else the root.
 */
function resolveThread(
  state: AppState,
  projectId: string,
  branch: string | null,
  byId: Map<string, ThreadNode>
): Pick<ActiveThread, "threadId" | "reason"> {
  if (branch) {
    const remembered = state.branchThreads?.[projectId]?.[branch];
    if (remembered && byId.has(remembered)) {
      return { threadId: remembered, reason: "branch-memory" };
    }

    const linked = [...byId.values()]
      .filter((t) => t.metadata.branch === branch && !t.metadata.status)
      .sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt));
    if (linked.length > 0) {
      return { threadId: linked[0].metadata.id, reason: "branch" };
    }
  }

  const last =
    state.activeProjectId === projectId && state.activeThreadId
      ? byId.get(state.activeThreadId)
      : undefined;
  const linkedElsewhere =
    branch !== null &&
    last?.metadata.branch !== undefined &&
    last.metadata.branch !== branch;
  if (last && !linkedElsewhere) {
    return { threadId: last.metadata.id, reason: "last-used" };
  }

  const root =
    byId.get("main") ??
    [...byId.values()].find((t) => t.metadata.parentId === null) ??
    [...byId.values()][0];
  return { threadId: root.metadata.id, reason: "default" };
}
