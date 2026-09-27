import { normalizeTitle, slugify } from "./ids.js";
import type {
  StorageService,
  ThreadService,
  ThreadNode,
  TreeStructure,
} from "../types/index.js";

export class ThreadServiceImpl implements ThreadService {
  constructor(private storage: StorageService) {}

  async create(opts: {
    projectId: string;
    parentId: string;
    title: string;
    author: string;
  }): Promise<ThreadNode> {
    const { projectId, parentId, author } = opts;
    const title = normalizeTitle(opts.title);

    return this.storage.withLock(async () => {
      // Validate parent exists
      const tree = await this.storage.readTree(projectId);
      if (!tree.nodes[parentId]) {
        throw new Error(`Parent thread "${parentId}" not found`);
      }

      const id = await this.generateUniqueId(projectId, title, tree);

      const now = new Date().toISOString();
      const node: ThreadNode = {
        metadata: {
          id,
          title,
          parentId,
          author,
          createdAt: now,
          updatedAt: now,
        },
        content: "",
      };

      // Write thread file
      await this.storage.writeThread(projectId, node);

      // Update tree
      tree.nodes[id] = { parentId, children: [] };
      tree.nodes[parentId].children.push(id);
      await this.storage.writeTree(projectId, tree);

      // Set as active thread
      const state = await this.storage.readConfig();
      await this.storage.writeConfig({
        ...state,
        activeThreadId: id,
      });

      return node;
    });
  }

  async switch(projectId: string, threadId: string): Promise<void> {
    await this.storage.withLock(async () => {
      const tree = await this.storage.readTree(projectId);
      assertThreadExists(tree, threadId);

      const state = await this.storage.readConfig();
      await this.storage.writeConfig({
        ...state,
        activeThreadId: threadId,
      });
    });
  }

  async list(projectId: string): Promise<string> {
    const tree = await this.storage.readTree(projectId);
    const state = await this.storage.readConfig();
    const activeThreadId = state.activeThreadId;

    // Find root nodes (parentId === null)
    const roots = Object.keys(tree.nodes).filter(
      (id) => tree.nodes[id].parentId === null
    );

    if (roots.length === 0) return "(empty tree)";

    const titles = new Map<string, string>();
    await Promise.all(
      Object.keys(tree.nodes).map(async (id) => {
        try {
          const node = await this.storage.readThread(projectId, id);
          titles.set(id, node.metadata.title);
        } catch {
          // Missing or unreadable thread file: show the bare ID
        }
      })
    );

    const lines: string[] = [];
    const visited = new Set<string>();

    const render = (
      nodeId: string,
      prefix: string,
      isRoot: boolean,
      isLast: boolean
    ): void => {
      // Guard against cycles in a corrupted tree file
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const connector = isRoot ? "" : isLast ? "└── " : "├── ";
      const title = titles.get(nodeId);
      // Only show the title when the ID alone does not convey it
      // (the root's title is the project title, already known)
      const label =
        !isRoot && title && slugify(title) !== nodeId
          ? `${nodeId} — ${title}`
          : nodeId;
      const activeMarker = nodeId === activeThreadId ? " ← active" : "";
      lines.push(`${prefix}${connector}${label}${activeMarker}`);

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
    mode: "solo" | "team";
  }): Promise<void> {
    const { projectId, threadId, content, author, mode } = opts;

    await this.storage.withLock(async () => {
      const tree = await this.storage.readTree(projectId);
      assertThreadExists(tree, threadId);

      const node = await this.storage.readThread(projectId, threadId);

      // Team mode: check ownership
      if (mode === "team" && node.metadata.author !== author) {
        throw new Error(
          `Cannot update thread "${threadId}": owned by "${node.metadata.author}", you are "${author}"`
        );
      }

      node.content = content;
      node.metadata.updatedAt = new Date().toISOString();
      await this.storage.writeThread(projectId, node);
    });
  }

  async delete(opts: {
    projectId: string;
    threadId: string;
    author: string;
    mode: "solo" | "team";
  }): Promise<void> {
    const { projectId, threadId, author, mode } = opts;

    if (threadId === "main") {
      throw new Error("Cannot delete the main thread");
    }

    await this.storage.withLock(async () => {
      const tree = await this.storage.readTree(projectId);
      assertThreadExists(tree, threadId);

      const node = await this.storage.readThread(projectId, threadId);

      // Collect all descendants
      const toDelete = this.collectDescendants(threadId, tree);
      toDelete.push(threadId);

      // Team mode: check ownership, including descendants deleted by the cascade
      if (mode === "team") {
        if (node.metadata.author !== author) {
          throw new Error(
            `Cannot delete thread "${threadId}": owned by "${node.metadata.author}", you are "${author}"`
          );
        }
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

      const parentId = tree.nodes[threadId].parentId;

      // Delete all thread files
      for (const id of toDelete) {
        await this.storage.deleteThread(projectId, id);
        delete tree.nodes[id];
      }

      // Remove from parent's children
      if (parentId && tree.nodes[parentId]) {
        tree.nodes[parentId].children = tree.nodes[parentId].children.filter(
          (c) => c !== threadId
        );
      }

      await this.storage.writeTree(projectId, tree);

      // If active thread was deleted, switch to main
      const state = await this.storage.readConfig();
      if (state.activeThreadId && toDelete.includes(state.activeThreadId)) {
        await this.storage.writeConfig({
          ...state,
          activeThreadId: "main",
        });
      }
    });
  }

  async rebase(opts: {
    projectId: string;
    threadId: string;
    newParentId: string;
    author: string;
    mode: "solo" | "team";
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

      // Team mode: check ownership
      if (mode === "team" && node.metadata.author !== author) {
        throw new Error(
          `Cannot rebase thread "${threadId}": owned by "${node.metadata.author}", you are "${author}"`
        );
      }

      if (!tree.nodes[newParentId]) {
        throw new Error(`Target parent thread "${newParentId}" not found`);
      }

      const oldParentId = tree.nodes[threadId].parentId;
      if (oldParentId === newParentId) {
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

      // Remove from old parent's children
      if (oldParentId && tree.nodes[oldParentId]) {
        tree.nodes[oldParentId].children = tree.nodes[
          oldParentId
        ].children.filter((c) => c !== threadId);
      }

      // Add to new parent's children
      tree.nodes[newParentId].children.push(threadId);

      // Update parentId in tree node
      tree.nodes[threadId].parentId = newParentId;

      await this.storage.writeTree(projectId, tree);

      // Update thread frontmatter
      const now = new Date().toISOString();
      await this.storage.writeThread(projectId, {
        ...node,
        metadata: { ...node.metadata, parentId: newParentId, updatedAt: now },
      });
    });
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
    // Also skip IDs whose file exists outside the tree, so it is never overwritten
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

/** IDs of the active project's threads that start with a typed prefix. */
export async function completeThreadIds(
  storage: StorageService,
  prefix: string
): Promise<string[]> {
  try {
    const state = await storage.readConfig();
    if (!state.activeProjectId) return [];
    const tree = await storage.readTree(state.activeProjectId);
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
