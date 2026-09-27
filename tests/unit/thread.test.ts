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

    it("renders nested levels with connectors", async () => {
      const create = (title: string, parentId: string) =>
        threadService.create({ projectId: "proj", parentId, title, author: "test-user" });

      await create("Auth", "main");
      await create("Auth UI", "auth");
      await create("Auth API", "auth");
      await create("Dashboard", "main");
      await create("Charts", "dashboard");
      await threadService.switch("proj", "auth-ui");

      expect(await threadService.list("proj")).toBe(
        [
          "main",
          "├── auth",
          "│   ├── auth-ui ← active",
          "│   └── auth-api",
          "└── dashboard",
          "    └── charts",
        ].join("\n")
      );
    });

    it("shows the title when the ID does not convey it", async () => {
      const create = (title: string) =>
        threadService.create({ projectId: "proj", parentId: "main", title, author: "test-user" });

      await create("Feature");
      await create("Feature");
      await create("认证模块");

      expect(await threadService.list("proj")).toBe(
        [
          "main",
          "├── feature",
          "├── feature-2 — Feature",
          "└── thread — 认证模块 ← active",
        ].join("\n")
      );
    });
  });

  describe("create (robustness)", () => {
    it("falls back to a readable ID for titles without Latin letters", async () => {
      const first = await threadService.create({
        projectId: "proj", parentId: "main", title: "认证模块", author: "test-user",
      });
      const second = await threadService.create({
        projectId: "proj", parentId: "main", title: "مصادقة", author: "test-user",
      });

      expect(first.metadata.id).toBe("thread");
      expect(second.metadata.id).toBe("thread-2");
      expect((await storage.readThread("proj", "thread-2")).metadata.title).toBe("مصادقة");
    });

    it("keeps multi-line titles on a single line", async () => {
      const node = await threadService.create({
        projectId: "proj",
        parentId: "main",
        title: "Innocent\nid: ../../../PWNED",
        author: "test-user",
      });

      expect(node.metadata.id).toBe("innocent-id-pwned");
      const read = await storage.readThread("proj", node.metadata.id);
      expect(read.metadata.title).toBe("Innocent id: ../../../PWNED");
      expect(read.metadata.parentId).toBe("main");
    });

    it("keeps every thread when creations run in parallel", async () => {
      const titles = ["A", "B", "C", "D", "E", "F"];
      await Promise.all(
        titles.map((title) =>
          threadService.create({ projectId: "proj", parentId: "main", title, author: "test-user" })
        )
      );

      const tree = await storage.readTree("proj");
      expect([...tree.nodes["main"].children].sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
    });

    it("never overwrites a thread file that is missing from the tree", async () => {
      await storage.writeThread("proj", {
        metadata: {
          id: "orphan",
          title: "Orphan",
          parentId: "main",
          author: "test-user",
          createdAt: "",
          updatedAt: "",
        },
        content: "Precious summary.",
      });

      const node = await threadService.create({
        projectId: "proj", parentId: "main", title: "Orphan", author: "test-user",
      });

      expect(node.metadata.id).toBe("orphan-2");
      expect((await storage.readThread("proj", "orphan")).content).toBe("Precious summary.");
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

    it("rejects threads that are not in the tree", async () => {
      await expect(
        threadService.updateSummary({
          projectId: "proj",
          threadId: "ghost",
          content: "x",
          author: "test-user",
          mode: "solo",
        })
      ).rejects.toThrow('Thread "ghost" not found');
    });

    it("lets the owner update a thread whose title contains ---", async () => {
      const node = await threadService.create({
        projectId: "proj",
        parentId: "main",
        title: "Refactor --- phase 2",
        author: "test-user",
      });

      await threadService.updateSummary({
        projectId: "proj",
        threadId: node.metadata.id,
        content: "New summary",
        author: "test-user",
        mode: "team",
      });

      const read = await storage.readThread("proj", node.metadata.id);
      expect(read.metadata.title).toBe("Refactor --- phase 2");
      expect(read.metadata.parentId).toBe("main");
      expect(read.content).toBe("New summary");
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

    it("rejects threads that are not in the tree", async () => {
      await expect(
        threadService.delete({
          projectId: "proj",
          threadId: "ghost",
          author: "test-user",
          mode: "solo",
        })
      ).rejects.toThrow('Thread "ghost" not found');
    });

    it("refuses to cascade over teammates' threads in team mode", async () => {
      await threadService.create({ projectId: "proj", parentId: "main", title: "Mine", author: "alice" });
      await threadService.create({ projectId: "proj", parentId: "mine", title: "Theirs", author: "bob" });

      await expect(
        threadService.delete({
          projectId: "proj",
          threadId: "mine",
          author: "alice",
          mode: "team",
        })
      ).rejects.toThrow("theirs (bob)");

      const tree = await storage.readTree("proj");
      expect(tree.nodes["mine"]).toBeDefined();
      expect(tree.nodes["theirs"]).toBeDefined();
    });
  });

  describe("rebase", () => {
    it("moves a thread to a new parent and updates tree + frontmatter", async () => {
      // Create: main → feature-a, main → feature-b
      await threadService.create({ projectId: "proj", parentId: "main", title: "Feature A", author: "test-user" });
      await threadService.switch("proj", "main");
      await threadService.create({ projectId: "proj", parentId: "main", title: "Feature B", author: "test-user" });

      // Rebase feature-a under feature-b
      await threadService.rebase({
        projectId: "proj",
        threadId: "feature-a",
        newParentId: "feature-b",
        author: "test-user",
        mode: "solo",
      });

      const tree = await storage.readTree("proj");
      // feature-a is now under feature-b
      expect(tree.nodes["feature-b"].children).toContain("feature-a");
      expect(tree.nodes["feature-a"].parentId).toBe("feature-b");
      // feature-a is no longer under main
      expect(tree.nodes["main"].children).not.toContain("feature-a");

      // Frontmatter is updated
      const node = await storage.readThread("proj", "feature-a");
      expect(node.metadata.parentId).toBe("feature-b");
    });

    it("throws when attempting to create a circular reference", async () => {
      await threadService.create({ projectId: "proj", parentId: "main", title: "Parent", author: "test-user" });
      await threadService.create({ projectId: "proj", parentId: "parent", title: "Child", author: "test-user" });

      // Cannot rebase parent onto its own descendant (child)
      await expect(
        threadService.rebase({
          projectId: "proj",
          threadId: "parent",
          newParentId: "child",
          author: "test-user",
          mode: "solo",
        })
      ).rejects.toThrow("is a descendant of");
    });

    it("cannot rebase the main thread", async () => {
      await threadService.create({ projectId: "proj", parentId: "main", title: "Other", author: "test-user" });

      await expect(
        threadService.rebase({
          projectId: "proj",
          threadId: "main",
          newParentId: "other",
          author: "test-user",
          mode: "solo",
        })
      ).rejects.toThrow("Cannot rebase the main thread");
    });

    it("rejects rebase from non-owner in team mode", async () => {
      await threadService.create({ projectId: "proj", parentId: "main", title: "Feature A", author: "alice" });
      await threadService.switch("proj", "main");
      await threadService.create({ projectId: "proj", parentId: "main", title: "Feature B", author: "bob" });

      await expect(
        threadService.rebase({
          projectId: "proj",
          threadId: "feature-a",
          newParentId: "feature-b",
          author: "bob",      // bob trying to move alice's thread
          mode: "team",
        })
      ).rejects.toThrow("Cannot rebase thread");
    });
  });
});
