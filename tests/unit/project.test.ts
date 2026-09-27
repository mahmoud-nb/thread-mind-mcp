import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StorageServiceImpl } from "../../src/core/storage.js";
import {
  ProjectServiceImpl,
  authorIdFrom,
} from "../../src/core/project.js";

let tempDir: string;
let storage: StorageServiceImpl;
let projectService: ProjectServiceImpl;

beforeEach(async () => {
  delete process.env.THREADMIND_AUTHOR;
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

      // The author is created with the first project
      const state = await storage.readConfig();
      expect(state.author).toBeTruthy();
    });

    it("handles duplicate titles", async () => {
      await projectService.create({ title: "Duplicate" });
      const second = await projectService.create({ title: "Duplicate" });
      expect(second.id).toBe("duplicate-2");
    });

    it("derives readable IDs from accented or non-Latin titles", async () => {
      const accented = await projectService.create({ title: "Système de paiement" });
      const nonLatin = await projectService.create({ title: "认证" });

      expect(accented.id).toBe("systeme-de-paiement");
      expect(nonLatin.id).toBe("project");
      expect(nonLatin.title).toBe("认证");
    });
  });

  describe("resolveAuthor", () => {
    it("creates the author on first use and then reuses it", async () => {
      const first = await projectService.resolveAuthor();
      const second = await projectService.resolveAuthor();

      expect(first).toMatch(/^[a-z0-9-]+-[0-9a-f]{4}$/);
      expect(second).toBe(first);
      expect((await storage.readConfig()).author).toBe(first);
    });

    it("keeps an existing author", async () => {
      await storage.writeConfig({
        activeProjectId: null,
        activeThreadId: null,
        author: "legacy-1a2b",
        version: 1,
      });
      expect(await projectService.resolveAuthor()).toBe("legacy-1a2b");
    });

    it("lets THREADMIND_AUTHOR override the stored author", async () => {
      process.env.THREADMIND_AUTHOR = "ci-bot";
      expect(await projectService.resolveAuthor()).toBe("ci-bot");
      expect((await storage.readConfig()).author).toBe("");
    });
  });

  describe("authorIdFrom", () => {
    it("is stable for the same git identity", () => {
      const a = authorIdFrom("Sarah Connor", "sarah@example.com");
      expect(a).toMatch(/^sarah-connor-[0-9a-f]{4}$/);
      expect(authorIdFrom("Sarah Connor", " Sarah@Example.com ")).toBe(a);
    });

    it("distinguishes people with the same name", () => {
      expect(authorIdFrom("Alex", "alex@one.dev")).not.toBe(
        authorIdFrom("Alex", "alex@two.dev")
      );
    });

    it("falls back to a random suffix without email", () => {
      expect(authorIdFrom("", "")).toMatch(/^user-[0-9a-f]{4}$/);
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

  describe("get", () => {
    it("returns a project's config", async () => {
      await projectService.create({ title: "First", mode: "team" });
      expect((await projectService.get("first")).mode).toBe("team");
    });

    it("throws on nonexistent project", async () => {
      await expect(projectService.get("nonexistent")).rejects.toThrow(
        'Project "nonexistent" not found'
      );
    });
  });
});
