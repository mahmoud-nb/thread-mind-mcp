import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StorageServiceImpl } from "../../src/core/storage.js";
import { ProjectServiceImpl } from "../../src/core/project.js";

let tempDir: string;
let storage: StorageServiceImpl;
let projectService: ProjectServiceImpl;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "threadmind-proj-"));
  storage = new StorageServiceImpl(tempDir);
  await storage.ensureInitialized();
  projectService = new ProjectServiceImpl(storage);
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("ProjectService", () => {
  describe("create", () => {
    it("creates a project with main thread and tree", async () => {
      const config = await projectService.create({
        title: "My Project",
        systemContext: "Be helpful.",
        mode: "solo",
      });

      expect(config.id).toBe("my-project");
      expect(config.title).toBe("My Project");
      expect(config.mode).toBe("solo");

      // Verify main thread was created
      const mainThread = await storage.readThread("my-project", "main");
      expect(mainThread.metadata.id).toBe("main");
      expect(mainThread.metadata.parentId).toBeNull();

      // Verify tree was created
      const tree = await storage.readTree("my-project");
      expect(tree.nodes["main"]).toBeDefined();

      // Verify state was updated
      const state = await storage.readConfig();
      expect(state.activeProjectId).toBe("my-project");
      expect(state.activeThreadId).toBe("main");
      expect(state.author).toBeTruthy();
    });

    it("handles duplicate titles", async () => {
      await projectService.create({ title: "Duplicate" });
      const second = await projectService.create({ title: "Duplicate" });
      expect(second.id).toBe("duplicate-2");
    });
  });

  describe("list", () => {
    it("lists all projects", async () => {
      await projectService.create({ title: "Alpha" });
      await projectService.create({ title: "Beta" });

      const projects = await projectService.list();
      expect(projects).toHaveLength(2);
    });
  });

  describe("switch", () => {
    it("switches active project", async () => {
      await projectService.create({ title: "First" });
      await projectService.create({ title: "Second" });

      await projectService.switch("first");
      const state = await storage.readConfig();
      expect(state.activeProjectId).toBe("first");
      expect(state.activeThreadId).toBe("main");
    });

    it("throws on nonexistent project", async () => {
      await expect(projectService.switch("nonexistent")).rejects.toThrow();
    });
  });

  describe("getActive", () => {
    it("returns null when no active project", async () => {
      const active = await projectService.getActive();
      expect(active).toBeNull();
    });

    it("returns active project config", async () => {
      await projectService.create({ title: "Active" });
      const active = await projectService.getActive();
      expect(active?.id).toBe("active");
    });
  });
});
