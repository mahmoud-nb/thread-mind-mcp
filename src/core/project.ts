import { execSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import process from "node:process";
import { normalizeTitle, slugify } from "./ids.js";
import { nowIso } from "./clock.js";
import type {
  ProjectConfig,
  StorageService,
  ProjectService,
  ThreadNode,
} from "../types/index.js";

export class ProjectServiceImpl implements ProjectService {
  constructor(private storage: StorageService) {}

  async create(opts: {
    title: string;
    systemContext?: string;
    mode?: "solo" | "team";
  }): Promise<ProjectConfig> {
    await this.storage.ensureInitialized();
    const title = normalizeTitle(opts.title);

    return this.storage.withLock(async () => {
      const id = await this.generateUniqueId(title);

      const config: ProjectConfig = {
        id,
        title,
        systemContext: opts.systemContext ?? "",
        mode: opts.mode ?? "solo",
        rootThreadId: "main",
      };

      // Create project config
      await this.storage.writeProjectConfig(config);

      const author = await ensureAuthor(this.storage);

      // Create the main thread, the root of the project's tree
      const now = nowIso();
      const mainThread: ThreadNode = {
        metadata: {
          id: "main",
          title,
          parentId: null,
          author,
          createdAt: now,
          updatedAt: now,
        },
        content: "",
      };
      await this.storage.writeThread(id, mainThread);

      return config;
    });
  }

  async list(): Promise<ProjectConfig[]> {
    return this.storage.listProjects();
  }

  async get(projectId: string): Promise<ProjectConfig> {
    try {
      return await this.storage.readProjectConfig(projectId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Project "${projectId}" not found`);
      }
      throw error;
    }
  }

  async resolveAuthor(): Promise<string> {
    return this.storage.withLock(() => ensureAuthor(this.storage));
  }

  private async generateUniqueId(title: string): Promise<string> {
    const id = slugify(title) || "project";
    const projects = await this.storage.listProjects();
    const existingIds = new Set(projects.map((p) => p.id));

    if (!existingIds.has(id)) return id;

    let counter = 2;
    while (existingIds.has(`${id}-${counter}`)) {
      counter++;
    }
    return `${id}-${counter}`;
  }
}

/**
 * Derive the author ID from the git identity so that the same person keeps
 * ownership of their threads across clones and machines.
 */
export function authorIdFrom(name: string, email: string): string {
  const base = slugify(name) || "user";
  const suffix = email.trim()
    ? createHash("sha256")
        .update(email.trim().toLowerCase())
        .digest("hex")
        .slice(0, 4)
    : randomUUID().slice(0, 4);
  return `${base}-${suffix}`;
}

/**
 * Return the local author ID, creating and persisting it on first use.
 * THREADMIND_AUTHOR overrides it. Must run while holding the storage lock.
 */
async function ensureAuthor(storage: StorageService): Promise<string> {
  const override = process.env.THREADMIND_AUTHOR?.trim();
  if (override) return override;

  const state = await storage.readConfig();
  if (state.author) return state.author;

  const author = authorIdFrom(
    readGitConfig("user.name"),
    readGitConfig("user.email")
  );
  await storage.writeConfig({ ...state, author });
  return author;
}

function readGitConfig(key: string): string {
  try {
    return execSync(`git config ${key}`, {
      encoding: "utf-8",
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
  } catch {
    // git not available or key not set
    return "";
  }
}
