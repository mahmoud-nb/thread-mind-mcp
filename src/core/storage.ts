import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  unlink,
  rename,
  open,
  access,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";
import { ID_PATTERN, assertValidId } from "./ids.js";
import { acquireFileLock } from "./lock.js";
import type {
  AppState,
  ProjectConfig,
  ThreadNode,
  TreeNode,
  TreeStructure,
  StorageService,
} from "../types/index.js";

const DEFAULT_STATE: AppState = {
  activeProjectId: null,
  activeThreadId: null,
  author: "",
  version: 1,
};

export class StorageServiceImpl implements StorageService {
  private readonly dataDir: () => Promise<string>;
  private lockQueue: Promise<unknown> = Promise.resolve();
  private readonly lockOwner = new AsyncLocalStorage<true>();

  /**
   * @param basePath the .threadmind directory, or a function resolving it
   * lazily (defaults to .threadmind in the working directory)
   */
  constructor(basePath?: string | (() => Promise<string>)) {
    if (typeof basePath === "function") {
      this.dataDir = basePath;
    } else {
      const fixed = basePath ?? join(process.cwd(), ".threadmind");
      this.dataDir = async () => fixed;
    }
  }

  /** The directory that contains .threadmind (where instruction files go). */
  async workspaceRoot(): Promise<string> {
    return dirname(await this.dataDir());
  }

  async ensureInitialized(): Promise<void> {
    const base = await this.dataDir();
    await mkdir(join(base, "projects"), { recursive: true });
    await mkdir(join(base, "threads"), { recursive: true });

    // Create .gitignore to exclude config.json (per-user state)
    const gitignorePath = join(base, ".gitignore");
    try {
      await readFile(gitignorePath, "utf-8");
    } catch {
      await writeFile(
        gitignorePath,
        [
          "# Per-user state — never commit (each developer has their own active project/thread, author ID and session measurements)",
          "config.json",
          "",
          "# Transient lock and temporary files",
          ".lock",
          "*.tmp",
          "",
        ].join("\n"),
        "utf-8"
      );
    }
  }

  /**
   * Run a read-modify-write sequence exclusively: in-process through a
   * promise queue, across processes (several sessions on the same repository)
   * through a lock file. Re-entrant: code that already holds the lock runs
   * directly.
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    if (this.lockOwner.getStore()) return fn();

    const run = this.lockQueue.then(async () => {
      const base = await this.dataDir();
      await mkdir(base, { recursive: true });
      const release = await acquireFileLock(join(base, ".lock"));
      try {
        return await this.lockOwner.run(true, fn);
      } finally {
        await release();
      }
    });
    this.lockQueue = run.catch(() => undefined);
    return run;
  }

  // --- Config (AppState) ---

  async readConfig(): Promise<AppState> {
    const filePath = await this.resolve("config.json");
    try {
      const raw = await readFile(filePath, "utf-8");
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  async writeConfig(state: AppState): Promise<void> {
    await this.atomicWrite(
      await this.resolve("config.json"),
      JSON.stringify(state, null, 2)
    );
  }

  // --- ProjectConfig ---

  async readProjectConfig(projectId: string): Promise<ProjectConfig> {
    const raw = await readFile(await this.projectFile(projectId), "utf-8");
    return JSON.parse(raw) as ProjectConfig;
  }

  async writeProjectConfig(config: ProjectConfig): Promise<void> {
    await this.atomicWrite(
      await this.projectFile(config.id),
      JSON.stringify(config, null, 2)
    );
  }

  async listProjects(): Promise<ProjectConfig[]> {
    const dir = await this.resolve("projects");
    try {
      const files = await readdir(dir);
      const configs: ProjectConfig[] = [];
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const raw = await readFile(join(dir, file), "utf-8");
        configs.push(JSON.parse(raw) as ProjectConfig);
      }
      return configs;
    } catch {
      return [];
    }
  }

  // --- Threads ---

  async readThread(projectId: string, threadId: string): Promise<ThreadNode> {
    const raw = await readFile(
      await this.threadFile(projectId, threadId),
      "utf-8"
    );
    const node = parseFrontmatter(raw);
    // The file name is the identity: never trust an id stored inside the file
    node.metadata.id = threadId;
    return node;
  }

  async writeThread(projectId: string, node: ThreadNode): Promise<void> {
    const filePath = await this.threadFile(projectId, node.metadata.id);
    await mkdir(dirname(filePath), { recursive: true });
    await this.atomicWrite(
      filePath,
      serializeFrontmatter(node.metadata, node.content)
    );
  }

  async deleteThread(projectId: string, threadId: string): Promise<void> {
    const filePath = await this.threadFile(projectId, threadId);
    try {
      await unlink(filePath);
    } catch {
      // File may not exist
    }
  }

  async threadExists(projectId: string, threadId: string): Promise<boolean> {
    const filePath = await this.threadFile(projectId, threadId);
    return exists(filePath);
  }

  async listThreads(projectId: string): Promise<ThreadNode[]> {
    await this.migrateLegacyTree(projectId);

    let files: string[];
    try {
      files = await readdir(await this.resolve("threads", projectId));
    } catch {
      return [];
    }

    const threads = await Promise.all(
      files
        .filter((file) => file.endsWith(".md"))
        .map(async (file) => {
          const threadId = file.slice(0, -".md".length);
          if (!ID_PATTERN.test(threadId)) return null;
          try {
            return await this.readThread(projectId, threadId);
          } catch {
            // Unreadable thread file: leave it out
            return null;
          }
        })
    );
    return threads.filter((thread): thread is ThreadNode => thread !== null);
  }

  async readTree(projectId: string): Promise<TreeStructure> {
    return buildTree(await this.listThreads(projectId));
  }

  /**
   * Earlier versions kept the tree in trees/<project>.json, duplicating the
   * parentId of each thread file. That index was the one actually used, so it
   * wins: thread files are aligned on it, then it is deleted.
   */
  private async migrateLegacyTree(projectId: string): Promise<void> {
    assertValidId(projectId, "project");
    const legacyPath = await this.resolve("trees", `${projectId}.json`);
    if (!(await exists(legacyPath))) return;

    await this.withLock(async () => {
      let legacy: TreeStructure;
      try {
        legacy = JSON.parse(await readFile(legacyPath, "utf-8"));
      } catch {
        // Already migrated by another session
        return;
      }

      for (const [threadId, node] of Object.entries(legacy.nodes ?? {})) {
        const parentId = node?.parentId ?? null;
        if (!ID_PATTERN.test(threadId)) continue;
        if (parentId !== null && !ID_PATTERN.test(parentId)) continue;

        let thread: ThreadNode;
        try {
          thread = await this.readThread(projectId, threadId);
        } catch {
          continue;
        }
        if (thread.metadata.parentId !== parentId) {
          thread.metadata.parentId = parentId;
          await this.writeThread(projectId, thread);
        }
      }
      await unlink(legacyPath).catch(() => {});
    });
  }

  // --- Paths (every ID is validated before it becomes part of a path) ---

  private async resolve(...segments: string[]): Promise<string> {
    return join(await this.dataDir(), ...segments);
  }

  private async projectFile(projectId: string): Promise<string> {
    assertValidId(projectId, "project");
    return this.resolve("projects", `${projectId}.json`);
  }

  private async threadFile(
    projectId: string,
    threadId: string
  ): Promise<string> {
    assertValidId(projectId, "project");
    assertValidId(threadId, "thread");
    return this.resolve("threads", projectId, `${threadId}.md`);
  }

  // --- Helpers ---

  /** Write to a temp file, flush it, then atomically replace the target. */
  private async atomicWrite(
    filePath: string,
    data: string
  ): Promise<void> {
    const tmpPath = `${filePath}.${randomUUID().slice(0, 8)}.tmp`;
    try {
      const handle = await open(tmpPath, "w");
      try {
        await handle.writeFile(data, "utf-8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await renameWithRetry(tmpPath, filePath);
    } catch (error) {
      await unlink(tmpPath).catch(() => {});
      throw error;
    }
  }
}

/**
 * Build the tree from each thread's parentId. Children are ordered by
 * creation date; a thread whose parent is missing becomes a root, so it stays
 * visible.
 */
export function buildTree(threads: ThreadNode[]): TreeStructure {
  const nodes: Record<string, TreeNode> = {};
  for (const { metadata } of threads) {
    nodes[metadata.id] = { parentId: metadata.parentId, children: [] };
  }

  const ordered = [...threads].sort(
    (a, b) =>
      a.metadata.createdAt.localeCompare(b.metadata.createdAt) ||
      a.metadata.id.localeCompare(b.metadata.id)
  );
  for (const { metadata } of ordered) {
    const node = nodes[metadata.id];
    const parent = node.parentId !== null ? nodes[node.parentId] : undefined;
    if (!parent || node.parentId === metadata.id) {
      node.parentId = null;
      continue;
    }
    parent.children.push(metadata.id);
  }
  return { nodes };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * On Windows, replacing a file fails transiently while another process
 * (antivirus, indexer, editor) holds it open.
 */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const transient =
        process.platform === "win32" &&
        (code === "EPERM" || code === "EACCES" || code === "EBUSY");
      if (!transient || attempt >= 5) throw error;
      await delay(20 * 2 ** attempt);
    }
  }
}
