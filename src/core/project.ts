import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import type {
  ProjectConfig,
  AppState,
  StorageService,
  ProjectService,
  ThreadNode,
  TreeStructure,
} from "../types/index.js";

export class ProjectServiceImpl implements ProjectService {
  constructor(private storage: StorageService) {}

  async create(opts: {
    title: string;
    systemContext?: string;
    mode?: "solo" | "team";
  }): Promise<ProjectConfig> {
    await this.storage.ensureInitialized();

    const id = await this.generateUniqueId(opts.title);

    const config: ProjectConfig = {
      id,
      title: opts.title,
      systemContext: opts.systemContext ?? "",
      mode: opts.mode ?? "solo",
      rootThreadId: "main",
    };

    // Create project config
    await this.storage.writeProjectConfig(config);

    // Generate author ID
    const state = await this.storage.readConfig();
    let author = state.author;
    if (!author) {
      author = this.generateAuthorId();
    }

    // Create the main thread
    const now = new Date().toISOString();
    const mainThread: ThreadNode = {
      metadata: {
        id: "main",
        title: opts.title,
        parentId: null,
        author,
        createdAt: now,
        updatedAt: now,
      },
      content: "",
    };
    await this.storage.writeThread(id, mainThread);

    // Create the tree structure
    const tree: TreeStructure = {
      nodes: {
        main: { parentId: null, children: [] },
      },
    };
    await this.storage.writeTree(id, tree);

    // Update app state
    await this.storage.writeConfig({
      ...state,
      activeProjectId: id,
      activeThreadId: "main",
      author,
      version: 1,
    });

    return config;
  }

  async list(): Promise<ProjectConfig[]> {
    await this.storage.ensureInitialized();
    return this.storage.listProjects();
  }

  async switch(projectId: string): Promise<void> {
    // Validate project exists
    await this.storage.readProjectConfig(projectId);

    const state = await this.storage.readConfig();
    await this.storage.writeConfig({
      ...state,
      activeProjectId: projectId,
      activeThreadId: "main",
    });
  }

  async getActive(): Promise<ProjectConfig | null> {
    const state = await this.storage.readConfig();
    if (!state.activeProjectId) return null;
    try {
      return await this.storage.readProjectConfig(state.activeProjectId);
    } catch {
      return null;
    }
  }

  private async generateUniqueId(title: string): Promise<string> {
    let id = slugify(title);
    const projects = await this.storage.listProjects();
    const existingIds = new Set(projects.map((p) => p.id));

    if (!existingIds.has(id)) return id;

    let counter = 2;
    while (existingIds.has(`${id}-${counter}`)) {
      counter++;
    }
    return `${id}-${counter}`;
  }

  private generateAuthorId(): string {
    let gitName = "user";
    try {
      gitName = execSync("git config user.name", { encoding: "utf-8" }).trim();
    } catch {
      // git not available, use default
    }
    const shortId = randomUUID().slice(0, 4);
    return `${slugify(gitName)}-${shortId}`;
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
