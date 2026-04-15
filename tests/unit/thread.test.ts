import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StorageServiceImpl } from "../../src/core/storage.js";
import { ThreadServiceImpl } from "../../src/core/thread.js";

let tempDir: string;
let storage: StorageServiceImpl;
let threadService: ThreadServiceImpl;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "threadmind-thread-"));
  storage = new StorageServiceImpl(tempDir);
  await storage.ensureInitialized();
  threadService = new ThreadServiceImpl(storage);

  // Set up a basic project with main thread
  await storage.writeConfig({
    activeProjectId: "proj",
    activeThreadId: "main",
    author: "test-user",
    version: 1,
  });

  await storage.writeThread("proj", {
    metadata: {
      id: "main",
      title: "Main",
      parentId: null,
      author: "test-user",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    content: "",
  });

  await storage.writeTree("proj", {
    nodes: { main: { parentId: null, children: [] } },
  });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("ThreadService", () => {
  describe("create", () => {
    it("creates a child thread", async () => {
      const node = await threadService.create({
        projectId: "proj",
        parentId: "main",
        title: "Feature Auth",
        author: "test-user",
      });

      expect(node.metadata.id).toBe("feature-auth");
      expect(node.metadata.parentId).toBe("main");

      const tree = await storage.readTree("proj");
      expect(tree.nodes["feature-auth"]).toBeDefined();
      expect(tree.nodes["main"].children).toContain("feature-auth");
    });

    it("throws when parent does not exist", async () => {
      await expect(
        threadService.create({
          projectId: "proj",
          parentId: "nonexistent",
          title: "Orphan",
          author: "test-user",
        })
      ).rejects.toThrow('Parent thread "nonexistent" not found');
    });

    it("handles duplicate titles with suffix", async () => {
      await threadService.create({
        projectId: "proj",
        parentId: "main",
        title: "Feature",
        author: "test-user",
      });
      const second = await threadService.create({
        projectId: "proj",
        parentId: "main",
        title: "Feature",
        author: "test-user",
      });

      expect(second.metadata.id).toBe("feature-2");
    });
  });

  describe("switch", () => {
    it("switches to an existing thread", async () => {
      await threadService.create({
        projectId: "proj",
        parentId: "main",
        title: "Target",
        author: "test-user",
      });

      await threadService.switch("proj", "target");
      const state = await storage.readConfig();
      expect(state.activeThreadId).toBe("target");
    });

    it("throws on nonexistent thread", async () => {
      await expect(threadService.switch("proj", "nope")).rejects.toThrow(
        'Thread "nope" not found'
      );
    });
  });

  describe("list", () => {
    it("returns an ASCII tree", async () => {
      await threadService.create({
        projectId: "proj",
        parentId: "main",
        title: "Branch A",
        author: "test-user",
      });
      // Switch back to main so the next create goes under main
      await threadService.switch("proj", "main");
      await threadService.create({
        projectId: "proj",
        parentId: "main",
        title: "Branch B",
        author: "test-user",
      });

      const result = await threadService.list("proj");
      expect(result).toContain("main");
      expect(result).toContain("branch-a");
      expect(result).toContain("branch-b");
    });
  });

  describe("updateSummary", () => {
    it("updates thread content", async () => {
      await threadService.updateSummary({
        projectId: "proj",
        threadId: "main",
        content: "Updated summary.",
        author: "test-user",
        mode: "solo",
      });

      const node = await storage.readThread("proj", "main");
      expect(node.content).toBe("Updated summary.");
    });

    it("rejects update from non-owner in team mode", async () => {
      await expect(
        threadService.updateSummary({
          projectId: "proj",
          threadId: "main",
          content: "Hack!",
          author: "other-user",
          mode: "team",
        })
      ).rejects.toThrow("Cannot update thread");
    });
  });

  describe("delete", () => {
    it("deletes a thread and its descendants", async () => {
      await threadService.create({
        projectId: "proj",
        parentId: "main",
        title: "Parent",
        author: "test-user",
      });
      await threadService.create({
        projectId: "proj",
        parentId: "parent",
        title: "Child",
        author: "test-user",
      });

      await threadService.delete({
        projectId: "proj",
        threadId: "parent",
        author: "test-user",
        mode: "solo",
      });

      const tree = await storage.readTree("proj");
      expect(tree.nodes["parent"]).toBeUndefined();
      expect(tree.nodes["child"]).toBeUndefined();
      expect(tree.nodes["main"].children).not.toContain("parent");
    });

    it("cannot delete main thread", async () => {
      await expect(
        threadService.delete({
          projectId: "proj",
          threadId: "main",
          author: "test-user",
          mode: "solo",
        })
      ).rejects.toThrow("Cannot delete the main thread");
    });

    it("resets active thread to main when active is deleted", async () => {
      await threadService.create({
        projectId: "proj",
        parentId: "main",
        title: "To Delete",
        author: "test-user",
      });

      // Active thread is now "to-delete" (set by create)
      await threadService.delete({
        projectId: "proj",
        threadId: "to-delete",
        author: "test-user",
        mode: "solo",
      });

      const state = await storage.readConfig();
      expect(state.activeThreadId).toBe("main");
    });
  });
});
