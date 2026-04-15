import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
});
