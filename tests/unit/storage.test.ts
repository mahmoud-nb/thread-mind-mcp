import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtemp,
  rm,
  readdir,
  readFile,
  writeFile,
  utimes,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { StorageServiceImpl } from "../../src/core/storage.js";

let tempDir: string;
let storage: StorageServiceImpl;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "threadmind-test-"));
  storage = new StorageServiceImpl(tempDir);
  await storage.ensureInitialized();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("StorageService", () => {
  describe("config", () => {
    it("returns default config when none exists", async () => {
      const config = await storage.readConfig();
      expect(config.activeProjectId).toBeNull();
      expect(config.activeThreadId).toBeNull();
      expect(config.version).toBe(1);
    });

    it("writes and reads config", async () => {
      await storage.writeConfig({
        activeProjectId: "my-project",
        activeThreadId: "main",
        author: "test-user-1234",
        version: 1,
      });

      const config = await storage.readConfig();
      expect(config.activeProjectId).toBe("my-project");
      expect(config.author).toBe("test-user-1234");
    });
  });

  describe("projects", () => {
    it("writes and reads project config", async () => {
      const project = {
        id: "test-project",
        title: "Test Project",
        systemContext: "You are a helpful assistant.",
        mode: "solo" as const,
        rootThreadId: "main",
      };

      await storage.writeProjectConfig(project);
      const read = await storage.readProjectConfig("test-project");
      expect(read).toEqual(project);
    });

    it("lists projects", async () => {
      await storage.writeProjectConfig({
        id: "proj-a",
        title: "Project A",
        systemContext: "",
        mode: "solo",
        rootThreadId: "main",
      });
      await storage.writeProjectConfig({
        id: "proj-b",
        title: "Project B",
        systemContext: "",
        mode: "team",
        rootThreadId: "main",
      });

      const projects = await storage.listProjects();
      expect(projects).toHaveLength(2);
      const ids = projects.map((p) => p.id).sort();
      expect(ids).toEqual(["proj-a", "proj-b"]);
    });
  });

  describe("threads", () => {
    it("writes and reads a thread", async () => {
      const node = {
        metadata: {
          id: "feature-auth",
          title: "Auth Feature",
          parentId: "main",
          author: "test-1234",
          createdAt: "2026-04-15T10:00:00Z",
          updatedAt: "2026-04-15T10:00:00Z",
        },
        content: "Implemented JWT auth.",
      };

      await storage.writeThread("proj", node);
      const read = await storage.readThread("proj", "feature-auth");
      expect(read.metadata.id).toBe("feature-auth");
      expect(read.metadata.parentId).toBe("main");
      expect(read.content).toBe("Implemented JWT auth.");
    });

    it("checks thread existence", async () => {
      expect(await storage.threadExists("proj", "nope")).toBe(false);

      await storage.writeThread("proj", {
        metadata: {
          id: "exists",
          title: "Exists",
          parentId: null,
          author: "a",
          createdAt: "",
          updatedAt: "",
        },
        content: "",
      });

      expect(await storage.threadExists("proj", "exists")).toBe(true);
    });

    it("deletes a thread", async () => {
      await storage.writeThread("proj", {
        metadata: {
          id: "to-delete",
          title: "Delete Me",
          parentId: null,
          author: "a",
          createdAt: "",
          updatedAt: "",
        },
        content: "",
      });

      expect(await storage.threadExists("proj", "to-delete")).toBe(true);
      await storage.deleteThread("proj", "to-delete");
      expect(await storage.threadExists("proj", "to-delete")).toBe(false);
    });
  });

  describe("trees", () => {
    it("returns empty tree when none exists", async () => {
      const tree = await storage.readTree("nonexistent");
      expect(tree.nodes).toEqual({});
    });

    it("writes and reads tree", async () => {
      const tree = {
        nodes: {
          main: { parentId: null, children: ["feature-a"] },
          "feature-a": { parentId: "main", children: [] },
        },
      };

      await storage.writeTree("proj", tree);
      const read = await storage.readTree("proj");
      expect(read).toEqual(tree);
    });
  });

  describe("lazy data directory", () => {
    it("resolves the directory when first used", async () => {
      const dataDir = join(tempDir, "workspace", ".threadmind");
      let resolved = false;
      const lazy = new StorageServiceImpl(async () => {
        resolved = true;
        return dataDir;
      });
      expect(resolved).toBe(false);

      await lazy.ensureInitialized();
      await lazy.writeTree("proj", { nodes: {} });

      expect((await readdir(join(dataDir, "trees")))).toEqual(["proj.json"]);
      expect(await lazy.workspaceRoot()).toBe(join(tempDir, "workspace"));
    });
  });

  describe("ID validation", () => {
    const traversal = "../../../docs/index";

    it("rejects path traversal in thread IDs", async () => {
      await expect(storage.readThread("proj", traversal)).rejects.toThrow(
        "Invalid thread ID"
      );
      await expect(storage.deleteThread("proj", traversal)).rejects.toThrow(
        "Invalid thread ID"
      );
      await expect(storage.threadExists("proj", "a/b")).rejects.toThrow(
        "Invalid thread ID"
      );
    });

    it("rejects path traversal in project IDs", async () => {
      await expect(storage.readProjectConfig("../../package")).rejects.toThrow(
        "Invalid project ID"
      );
      await expect(storage.readTree("..")).rejects.toThrow(
        "Invalid project ID"
      );
      await expect(
        storage.writeTree("../evil", { nodes: {} })
      ).rejects.toThrow("Invalid project ID");
    });

    it("never takes a thread's identity from its file content", async () => {
      await storage.writeThread("proj", {
        metadata: {
          id: "legit",
          title: "Legit",
          parentId: "main",
          author: "a",
          createdAt: "",
          updatedAt: "",
        },
        content: "",
      });
      const filePath = join(tempDir, "threads", "proj", "legit.md");
      const tampered = (await readFile(filePath, "utf-8")).replace(
        "id: legit",
        "id: ../../../PWNED"
      );
      await writeFile(filePath, tampered);

      const node = await storage.readThread("proj", "legit");
      expect(node.metadata.id).toBe("legit");
    });
  });

  describe("atomic writes", () => {
    it("leaves no temporary files behind", async () => {
      for (let i = 0; i < 5; i++) {
        await storage.writeTree("proj", { nodes: {} });
        await storage.writeConfig({
          activeProjectId: "proj",
          activeThreadId: "main",
          author: "a",
          version: 1,
        });
      }
      const files = [
        ...(await readdir(tempDir)),
        ...(await readdir(join(tempDir, "trees"))),
      ];
      expect(files.filter((f) => f.endsWith(".tmp"))).toEqual([]);
    });
  });

  describe("withLock", () => {
    async function incrementCounter(s: StorageServiceImpl): Promise<void> {
      await s.withLock(async () => {
        const state = await s.readConfig();
        await delay(5); // widen the race window
        await s.writeConfig({ ...state, version: state.version + 1 });
      });
    }

    it("serializes read-modify-write sequences across instances", async () => {
      // Two instances on the same directory behave like two processes
      const other = new StorageServiceImpl(tempDir);
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          incrementCounter(i % 2 === 0 ? storage : other)
        )
      );

      const state = await storage.readConfig();
      expect(state.version).toBe(1 + 10);
      expect(await readdir(tempDir)).not.toContain(".lock");
    });

    it("reclaims a lock abandoned by a crashed process", async () => {
      const lockPath = join(tempDir, ".lock");
      await writeFile(lockPath, "crashed-process");
      const past = new Date(Date.now() - 60_000);
      await utimes(lockPath, past, past);

      await incrementCounter(storage);
      expect((await storage.readConfig()).version).toBe(2);
    });

    it("releases the lock when the operation fails", async () => {
      await expect(
        storage.withLock(async () => {
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");

      await incrementCounter(storage);
      expect((await storage.readConfig()).version).toBe(2);
    });
  });
});
