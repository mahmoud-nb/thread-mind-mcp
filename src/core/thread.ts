import { normalizeTitle, slugify } from "./ids.js";
import { nowIso } from "./clock.js";
import { buildTree } from "./storage.js";
import { updateSection } from "./summary.js";
import type {
  SessionService,
  StorageService,
  ThreadService,
  ThreadNode,
  ThreadStatus,
  TreeStructure,
  SummarySection,
} from "../types/index.js";

type Mode = "solo" | "team";

export class ThreadServiceImpl implements ThreadService {
  constructor(private storage: StorageService) {}

  async create(opts: {
    projectId: string;
    parentId: string;
    title: string;
    author: string;
    branch?: string;
  }): Promise<ThreadNode> {
    const { projectId, parentId, author, branch } = opts;
    const title = normalizeTitle(opts.title);

    return this.storage.withLock(async () => {
      // Validate parent exists
      const tree = await this.storage.readTree(projectId);
      if (!tree.nodes[parentId]) {
        throw new Error(`Parent thread "${parentId}" not found`);
      }

      const id = await this.generateUniqueId(projectId, title, tree);

      const now = nowIso();
      const node: ThreadNode = {
        metadata: {
          id,
          title,
          parentId,
          author,
          createdAt: now,
          updatedAt: now,
          ...(branch ? { branch } : {}),
        },
        content: "",
      };

      // The thread file is the tree: its parentId places it
      await this.storage.writeThread(projectId, node);
      return node;
    });
  }

  async list(projectId: string, activeThreadId: string | null): Promise<string> {
    const threads = await this.storage.listThreads(projectId);
    const tree = buildTree(threads);
    const metadata = new Map(threads.map((t) => [t.metadata.id, t.metadata]));

    const roots = threads
      .filter((t) => tree.nodes[t.metadata.id].parentId === null)
      .sort((a, b) => a.metadata.createdAt.localeCompare(b.metadata.createdAt))
      .map((t) => t.metadata.id);

    if (roots.length === 0) return "(empty tree)";

    const lines: string[] = [];
    const visited = new Set<string>();

    const render = (
      nodeId: string,
      prefix: string,
      isRoot: boolean,
      isLast: boolean
    ): void => {
      // Guard against parent cycles in hand-edited thread files
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const meta = metadata.get(nodeId);
      const connector = isRoot ? "" : isLast ? "└── " : "├── ";
      // Only show the title when the ID alone does not convey it
      // (the root's title is the project title, already known)
      const label =
        !isRoot && meta && slugify(meta.title) !== nodeId
          ? `${nodeId} — ${meta.title}`
          : nodeId;
      const status = meta?.status ? ` [${meta.status}]` : "";
      const branch = meta?.branch ? ` [branch: ${meta.branch}]` : "";
      const active = nodeId === activeThreadId ? " ← active" : "";
      lines.push(`${prefix}${connector}${label}${status}${branch}${active}`);

      const children = tree.nodes[nodeId]?.children ?? [];
      const childPrefix = isRoot ? "" : prefix + (isLast ? "    " : "│   ");
      children.forEach((childId, i) =>
        render(childId, childPrefix, false, i === children.length - 1)
      );
    };

    for (const root of roots) {
      render(root, "", true, true);
    }
    return lines.join("\n");
  }

  async get(projectId: string, threadId: string): Promise<ThreadNode> {
    return this.storage.readThread(projectId, threadId);
  }

  async updateSummary(opts: {
    projectId: string;
    threadId: string;
    content: string;
    author: string;
    mode: Mode;
    section?: SummarySection;
    replaceSection?: boolean;
    commit?: string;
    paths?: string[];
  }): Promise<ThreadNode> {
    const { projectId, threadId, content, author, mode } = opts;

    return this.storage.withLock(async () => {
      const node = await this.readExisting(projectId, threadId);
      assertOwner(node, author, mode, "update");

      node.content = opts.section
        ? updateSection(
            node.content,
            opts.section,
            content,
            opts.replaceSection ?? false
          )
        : content;
      node.metadata.updatedAt = nowIso();
      if (opts.commit) node.metadata.commit = opts.commit;
      if (opts.paths) {
        node.metadata.paths = opts.paths.length > 0 ? opts.paths : undefined;
      }

      await this.storage.writeThread(projectId, node);
      return node;
    });
  }

  async setStatus(opts: {
    projectId: string;
    threadId: string;
    status: ThreadStatus;
    reason?: string;
    author: string;
    mode: Mode;
  }): Promise<ThreadNode> {
    const { projectId, threadId, status, reason, author, mode } = opts;

    if (threadId === "main" && status !== "active") {
      throw new Error("The main thread cannot be closed");
    }

    return this.storage.withLock(async () => {
      const node = await this.readExisting(projectId, threadId);
      assertOwner(node, author, mode, "change the status of");

      if (status === "active") {
        delete node.metadata.status;
        delete node.metadata.mergedInto;
      } else {
        node.metadata.status = status;
      }
      if (reason) {
        // Keep the outcome in the thread's durable decisions
        node.content = updateSection(
          node.content,
          "decisions",
          `- ${STATUS_LABELS[status]}: ${reason.trim()}`,
          false
        );
      }
      node.metadata.updatedAt = nowIso();

      await this.storage.writeThread(projectId, node);
      return node;
    });
  }

  async merge(opts: {
    projectId: string;
    threadId: string;
    parentSummary: string;
    author: string;
    mode: Mode;
    commit?: string;
  }): Promise<{ parentId: string }> {
    const { projectId, threadId, parentSummary, author, mode, commit } = opts;

    return this.storage.withLock(async () => {
      const node = await this.readExisting(projectId, threadId);
      const parentId = node.metadata.parentId;
      if (!parentId) {
        throw new Error(`Thread "${threadId}" has no parent to merge into`);
      }
      const parent = await this.readExisting(projectId, parentId);
      assertOwner(node, author, mode, "merge");
      assertOwner(parent, author, mode, "update");

      const now = nowIso();
      parent.content = parentSummary;
      parent.metadata.updatedAt = now;
      if (commit) parent.metadata.commit = commit;

      node.metadata.status = "done";
      node.metadata.mergedInto = parentId;
      node.metadata.updatedAt = now;

      await this.storage.writeThread(projectId, parent);
      await this.storage.writeThread(projectId, node);
      return { parentId };
    });
  }

  async delete(opts: {
    projectId: string;
    threadId: string;
    author: string;
    mode: Mode;
  }): Promise<string[]> {
    const { projectId, threadId, author, mode } = opts;

    if (threadId === "main") {
      throw new Error("Cannot delete the main thread");
    }

    return this.storage.withLock(async () => {
      const tree = await this.storage.readTree(projectId);
      assertThreadExists(tree, threadId);

      const node = await this.storage.readThread(projectId, threadId);

      // Collect all descendants
      const toDelete = this.collectDescendants(threadId, tree);
      toDelete.push(threadId);

      // Team mode: check ownership, including descendants deleted by the cascade
      if (mode === "team") {
        assertOwner(node, author, mode, "delete");
        const foreign: string[] = [];
        for (const id of toDelete) {
          if (id === threadId) continue;
          try {
            const descendant = await this.storage.readThread(projectId, id);
            if (descendant.metadata.author !== author) {
              foreign.push(`${id} (${descendant.metadata.author})`);
            }
          } catch {
            // Missing descendant file: nothing to protect
          }
        }
        if (foreign.length > 0) {
          throw new Error(
            `Cannot delete thread "${threadId}": its descendants include threads owned by others: ${foreign.join(", ")}`
          );
        }
      }

      for (const id of toDelete) {
        await this.storage.deleteThread(projectId, id);
      }
      return toDelete;
    });
  }

  async rebase(opts: {
    projectId: string;
    threadId: string;
    newParentId: string;
    author: string;
    mode: Mode;
  }): Promise<void> {
    const { projectId, threadId, newParentId, author, mode } = opts;

    if (threadId === "main") {
      throw new Error("Cannot rebase the main thread");
    }
    if (threadId === newParentId) {
      throw new Error(`Cannot rebase "${threadId}" onto itself`);
    }

    await this.storage.withLock(async () => {
      const tree = await this.storage.readTree(projectId);
      assertThreadExists(tree, threadId);

      const node = await this.storage.readThread(projectId, threadId);
      assertOwner(node, author, mode, "rebase");

      if (!tree.nodes[newParentId]) {
        throw new Error(`Target parent thread "${newParentId}" not found`);
      }
      if (tree.nodes[threadId].parentId === newParentId) {
        throw new Error(
          `Thread "${threadId}" is already under "${newParentId}"`
        );
      }

      // Anti-circularity: newParentId must not be a descendant of threadId
      const descendants = this.collectDescendants(threadId, tree);
      if (descendants.includes(newParentId)) {
        throw new Error(
          `Cannot rebase "${threadId}" onto "${newParentId}": "${newParentId}" is a descendant of "${threadId}"`
        );
      }

      // Descendants follow automatically: they point at this thread
      await this.storage.writeThread(projectId, {
        ...node,
        metadata: {
          ...node.metadata,
          parentId: newParentId,
          updatedAt: nowIso(),
        },
      });
    });
  }

  private async readExisting(
    projectId: string,
    threadId: string
  ): Promise<ThreadNode> {
    if (!(await this.storage.threadExists(projectId, threadId))) {
      throw new Error(`Thread "${threadId}" not found`);
    }
    return this.storage.readThread(projectId, threadId);
  }

  private collectDescendants(
    threadId: string,
    tree: TreeStructure
  ): string[] {
    const result: string[] = [];
    const node = tree.nodes[threadId];
    if (!node) return result;

    for (const childId of node.children) {
      result.push(childId);
      result.push(...this.collectDescendants(childId, tree));
    }
    return result;
  }

  private async generateUniqueId(
    projectId: string,
    title: string,
    tree: TreeStructure
  ): Promise<string> {
    const base = slugify(title) || "thread";
    // Also skip IDs of unreadable files, so they are never overwritten
    const isTaken = async (id: string) =>
      Boolean(tree.nodes[id]) ||
      (await this.storage.threadExists(projectId, id));

    if (!(await isTaken(base))) return base;

    let counter = 2;
    while (await isTaken(`${base}-${counter}`)) {
      counter++;
    }
    return `${base}-${counter}`;
  }
}

const STATUS_LABELS: Record<ThreadStatus, string> = {
  active: "Reopened",
  done: "Done",
  abandoned: "Abandoned",
};

/** IDs of the session's project threads that start with a typed prefix. */
export async function completeThreadIds(
  storage: StorageService,
  session: SessionService,
  prefix: string
): Promise<string[]> {
  try {
    const active = await session.active();
    if (!active) return [];
    const tree = await storage.readTree(active.projectId);
    return Object.keys(tree.nodes).filter((id) => id.startsWith(prefix));
  } catch {
    return [];
  }
}

function assertThreadExists(tree: TreeStructure, threadId: string): void {
  if (!tree.nodes[threadId]) {
    throw new Error(`Thread "${threadId}" not found`);
  }
}

function assertOwner(
  node: ThreadNode,
  author: string,
  mode: Mode,
  action: string
): void {
  if (mode === "team" && node.metadata.author !== author) {
    throw new Error(
      `Cannot ${action} thread "${node.metadata.id}": owned by "${node.metadata.author}", you are "${author}"`
    );
  }
}
