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
    const { projectId, parentId, title, author } = opts;

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
  }

  async switch(projectId: string, threadId: string): Promise<void> {
    const tree = await this.storage.readTree(projectId);
    if (!tree.nodes[threadId]) {
      throw new Error(`Thread "${threadId}" not found`);
    }

    const state = await this.storage.readConfig();
    await this.storage.writeConfig({
      ...state,
      activeThreadId: threadId,
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

    const lines: string[] = [];
    for (const root of roots) {
      this.buildTreeLines(root, tree, "", true, lines, activeThreadId, projectId);
    }

    // Resolve titles
    const result: string[] = [];
    for (const line of lines) {
      result.push(line);
    }
    return result.join("\n");
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

    const node = await this.storage.readThread(projectId, threadId);

    // Team mode: check ownership
    if (mode === "team" && node.metadata.author !== author) {
      throw new Error(
        `Cannot delete thread "${threadId}": owned by "${node.metadata.author}", you are "${author}"`
      );
    }

    const tree = await this.storage.readTree(projectId);

    // Collect all descendants
    const toDelete = this.collectDescendants(threadId, tree);
    toDelete.push(threadId);

    // Delete all thread files
    for (const id of toDelete) {
      await this.storage.deleteThread(projectId, id);
      delete tree.nodes[id];
    }

    // Remove from parent's children
    const parentId = node.metadata.parentId;
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

  private buildTreeLines(
    nodeId: string,
    tree: TreeStructure,
    prefix: string,
    isLast: boolean,
    lines: string[],
    activeThreadId: string | null,
    projectId: string
  ): void {
    const connector = prefix === "" ? "" : isLast ? "└── " : "├── ";
    const activeMarker = nodeId === activeThreadId ? " ← active" : "";
    lines.push(`${prefix}${connector}${nodeId}${activeMarker}`);

    const node = tree.nodes[nodeId];
    if (!node) return;

    const childPrefix =
      prefix === "" ? "" : prefix + (isLast ? "    " : "│   ");
    const children = node.children;

    for (let i = 0; i < children.length; i++) {
      this.buildTreeLines(
        children[i],
        tree,
        childPrefix,
        i === children.length - 1,
        lines,
        activeThreadId,
        projectId
      );
    }
  }

  private async generateUniqueId(
    projectId: string,
    title: string,
    tree: TreeStructure
  ): Promise<string> {
    let id = slugify(title);
    if (!tree.nodes[id]) return id;

    let counter = 2;
    while (tree.nodes[`${id}-${counter}`]) {
      counter++;
    }
    return `${id}-${counter}`;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
