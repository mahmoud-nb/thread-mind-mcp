import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  unlink,
  rm,
  rename,
  open,
  access,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";
import { assertValidId } from "./ids.js";
import { acquireFileLock } from "./lock.js";
import type {
  AppState,
  ProjectConfig,
  ProjectStats,
  ThreadNode,
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
  private basePath: string;
  private lockQueue: Promise<unknown> = Promise.resolve();

  constructor(basePath?: string) {
    this.basePath = basePath ?? join(process.cwd(), ".threadmind");
  }

  async ensureInitialized(): Promise<void> {
    await mkdir(join(this.basePath, "projects"), { recursive: true });
    await mkdir(join(this.basePath, "threads"), { recursive: true });
    await mkdir(join(this.basePath, "trees"), { recursive: true });
    await mkdir(join(this.basePath, "stats"), { recursive: true });

    // Create .gitignore to exclude config.json (per-user state)
    const gitignorePath = join(this.basePath, ".gitignore");
    try {
      await readFile(gitignorePath, "utf-8");
    } catch {
      await writeFile(
        gitignorePath,
        [
          "# Per-user state — never commit (each developer has their own active project/thread and author ID)",
          "config.json",
          "",
          "# Transient lock and temporary files",
          ".lock",
          "*.tmp",
          "",
          "# Token savings statistics — optional",
          "# Uncomment the line below to ignore stats/ if you prefer to avoid merge conflicts",
          "# (every summary_update call modifies this file).",
          "# Keep it committed if you want team-wide cumulative token savings tracking.",
          "# stats/",
          "",
        ].join("\n"),
        "utf-8"
      );
    }
  }

  /**
   * Run a read-modify-write sequence exclusively: in-process through a
   * promise queue, across processes (several sessions on the same repository)
   * through a lock file. Not re-entrant: never call withLock inside fn.
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.lockQueue.then(async () => {
      await mkdir(this.basePath, { recursive: true });
      const release = await acquireFileLock(join(this.basePath, ".lock"));
      try {
        return await fn();
      } finally {
        await release();
      }
    });
    this.lockQueue = run.catch(() => undefined);
    return run;
  }

  // --- Config (AppState) ---

  async readConfig(): Promise<AppState> {
    try {
      const raw = await readFile(
        join(this.basePath, "config.json"),
        "utf-8"
      );
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  async writeConfig(state: AppState): Promise<void> {
    await this.atomicWrite(
      join(this.basePath, "config.json"),
      JSON.stringify(state, null, 2)
    );
  }

  // --- ProjectConfig ---

  async readProjectConfig(projectId: string): Promise<ProjectConfig> {
    const raw = await readFile(this.projectFile(projectId), "utf-8");
    return JSON.parse(raw) as ProjectConfig;
  }

  async writeProjectConfig(config: ProjectConfig): Promise<void> {
    await this.atomicWrite(
      this.projectFile(config.id),
      JSON.stringify(config, null, 2)
    );
  }

  async listProjects(): Promise<ProjectConfig[]> {
    try {
      const files = await readdir(join(this.basePath, "projects"));
      const configs: ProjectConfig[] = [];
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const raw = await readFile(
          join(this.basePath, "projects", file),
          "utf-8"
        );
        configs.push(JSON.parse(raw) as ProjectConfig);
      }
      return configs;
    } catch {
      return [];
    }
  }

  // --- Threads ---

  async readThread(projectId: string, threadId: string): Promise<ThreadNode> {
    const raw = await readFile(this.threadFile(projectId, threadId), "utf-8");
    const node = parseFrontmatter(raw);
    // The file name is the identity: never trust an id stored inside the file
    node.metadata.id = threadId;
    return node;
  }

  async writeThread(projectId: string, node: ThreadNode): Promise<void> {
    const filePath = this.threadFile(projectId, node.metadata.id);
    await mkdir(dirname(filePath), { recursive: true });
    await this.atomicWrite(
      filePath,
      serializeFrontmatter(node.metadata, node.content)
    );
  }

  async deleteThread(projectId: string, threadId: string): Promise<void> {
    const filePath = this.threadFile(projectId, threadId);
    try {
      await unlink(filePath);
    } catch {
      // File may not exist
    }
  }

  async threadExists(projectId: string, threadId: string): Promise<boolean> {
    const filePath = this.threadFile(projectId, threadId);
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // --- Trees ---

  async readTree(projectId: string): Promise<TreeStructure> {
    const filePath = this.treeFile(projectId);
    try {
      const raw = await readFile(filePath, "utf-8");
      return JSON.parse(raw) as TreeStructure;
    } catch {
      return { nodes: {} };
    }
  }

  async writeTree(projectId: string, tree: TreeStructure): Promise<void> {
    await this.atomicWrite(
      this.treeFile(projectId),
      JSON.stringify(tree, null, 2)
    );
  }

  // --- Stats ---

  async readProjectStats(projectId: string): Promise<ProjectStats> {
    const filePath = this.statsFile(projectId);
    try {
      const raw = await readFile(filePath, "utf-8");
      return JSON.parse(raw) as ProjectStats;
    } catch {
      return { projectId, threads: {} };
    }
  }

  async writeProjectStats(
    projectId: string,
    stats: ProjectStats
  ): Promise<void> {
    await this.atomicWrite(
      this.statsFile(projectId),
      JSON.stringify(stats, null, 2)
    );
  }

  // --- Cleanup ---

  async deleteProjectDir(projectId: string): Promise<void> {
    assertValidId(projectId, "project");
    try {
      await rm(join(this.basePath, "threads", projectId), {
        recursive: true,
        force: true,
      });
    } catch {
      // Directory may not exist
    }
    try {
      await unlink(this.statsFile(projectId));
    } catch {
      // Stats file may not exist
    }
  }

  // --- Paths (every ID is validated before it becomes part of a path) ---

  private projectFile(projectId: string): string {
    assertValidId(projectId, "project");
    return join(this.basePath, "projects", `${projectId}.json`);
  }

  private threadFile(projectId: string, threadId: string): string {
    assertValidId(projectId, "project");
    assertValidId(threadId, "thread");
    return join(this.basePath, "threads", projectId, `${threadId}.md`);
  }

  private treeFile(projectId: string): string {
    assertValidId(projectId, "project");
    return join(this.basePath, "trees", `${projectId}.json`);
  }

  private statsFile(projectId: string): string {
    assertValidId(projectId, "project");
    return join(this.basePath, "stats", `${projectId}.json`);
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
