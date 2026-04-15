import { readFile, writeFile, mkdir, readdir, unlink, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";
import type {
  AppState,
  ProjectConfig,
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

  constructor(basePath?: string) {
    this.basePath = basePath ?? join(process.cwd(), ".threadmind");
  }

  async ensureInitialized(): Promise<void> {
    await mkdir(join(this.basePath, "projects"), { recursive: true });
    await mkdir(join(this.basePath, "threads"), { recursive: true });
    await mkdir(join(this.basePath, "trees"), { recursive: true });

    // Create .gitignore to exclude config.json (per-user state)
    const gitignorePath = join(this.basePath, ".gitignore");
    try {
      await readFile(gitignorePath, "utf-8");
    } catch {
      await writeFile(gitignorePath, "config.json\n", "utf-8");
    }
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
    const raw = await readFile(
      join(this.basePath, "projects", `${projectId}.json`),
      "utf-8"
    );
    return JSON.parse(raw) as ProjectConfig;
  }

  async writeProjectConfig(config: ProjectConfig): Promise<void> {
    await this.atomicWrite(
      join(this.basePath, "projects", `${config.id}.json`),
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
    const raw = await readFile(
      join(this.basePath, "threads", projectId, `${threadId}.md`),
      "utf-8"
    );
    return parseFrontmatter(raw);
  }

  async writeThread(projectId: string, node: ThreadNode): Promise<void> {
    await mkdir(join(this.basePath, "threads", projectId), {
      recursive: true,
    });
    const raw = serializeFrontmatter(node.metadata, node.content);
    await this.atomicWrite(
      join(this.basePath, "threads", projectId, `${node.metadata.id}.md`),
      raw
    );
  }

  async deleteThread(projectId: string, threadId: string): Promise<void> {
    try {
      await unlink(
        join(this.basePath, "threads", projectId, `${threadId}.md`)
      );
    } catch {
      // File may not exist
    }
  }

  async threadExists(projectId: string, threadId: string): Promise<boolean> {
    try {
      await readFile(
        join(this.basePath, "threads", projectId, `${threadId}.md`),
        "utf-8"
      );
      return true;
    } catch {
      return false;
    }
  }

  // --- Trees ---

  async readTree(projectId: string): Promise<TreeStructure> {
    try {
      const raw = await readFile(
        join(this.basePath, "trees", `${projectId}.json`),
        "utf-8"
      );
      return JSON.parse(raw) as TreeStructure;
    } catch {
      return { nodes: {} };
    }
  }

  async writeTree(projectId: string, tree: TreeStructure): Promise<void> {
    await this.atomicWrite(
      join(this.basePath, "trees", `${projectId}.json`),
      JSON.stringify(tree, null, 2)
    );
  }

  // --- Cleanup ---

  async deleteProjectDir(projectId: string): Promise<void> {
    try {
      await rm(join(this.basePath, "threads", projectId), {
        recursive: true,
        force: true,
      });
    } catch {
      // Directory may not exist
    }
  }

  // --- Helpers ---

  private async atomicWrite(
    filePath: string,
    data: string
  ): Promise<void> {
    const tmpPath = `${filePath}.${randomUUID().slice(0, 8)}.tmp`;
    await writeFile(tmpPath, data, "utf-8");
    await writeFile(filePath, data, "utf-8");
    try {
      await unlink(tmpPath);
    } catch {
      // Temp file cleanup is best-effort
    }
  }
}
