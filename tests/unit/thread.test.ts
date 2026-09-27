import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StorageServiceImpl } from "../../src/core/storage.js";
import { ThreadServiceImpl } from "../../src/core/thread.js";

let tempDir: string;
let storage: StorageServiceImpl;
let threadService: ThreadServiceImpl;

const create = (title: string, parentId = "main", author = "test-user") =>
  threadService.create({ projectId: "proj", parentId, title, author });

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "threadmind-thread-"));
  storage = new StorageServiceImpl(tempDir);
  await storage.ensureInitialized();
  threadService = new ThreadServiceImpl(storage);

  // A project with its main thread: the thread files are the tree
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
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("ThreadService", () => {
  describe("create", () => {
    it("creates a child thread", async () => {
      const node = await create("Feature Auth");

      expect(node.metadata.id).toBe("feature-auth");
      expect(node.metadata.parentId).toBe("main");

      const tree = await storage.readTree("proj");
      expect(tree.nodes["feature-auth"]).toBeDefined();
      expect(tree.nodes["main"].children).toContain("feature-auth");
    });

    it("throws when parent does not exist", async () => {
      await expect(create("Orphan", "nonexistent")).rejects.toThrow(
        'Parent thread "nonexistent" not found'
      );
    });

    it("handles duplicate titles with suffix", async () => {
      await create("Feature");
      const second = await create("Feature");
      expect(second.metadata.id).toBe("feature-2");
    });

    it("links the thread to a git branch when given one", async () => {
      await threadService.create({
        projectId: "proj",
        parentId: "main",
        title: "Auth UI",
        author: "test-user",
        branch: "feature/auth-ui",
      });

      const node = await storage.readThread("proj", "auth-ui");
      expect(node.metadata.branch).toBe("feature/auth-ui");
    });
  });

  describe("create (robustness)", () => {
    it("falls back to a readable ID for titles without Latin letters", async () => {
      const first = await create("认证模块");
      const second = await create("مصادقة");

      expect(first.metadata.id).toBe("thread");
      expect(second.metadata.id).toBe("thread-2");
      expect((await storage.readThread("proj", "thread-2")).metadata.title).toBe("مصادقة");
    });

    it("keeps multi-line titles on a single line", async () => {
      const node = await create("Innocent\nid: ../../../PWNED");

      expect(node.metadata.id).toBe("innocent-id-pwned");
      const read = await storage.readThread("proj", node.metadata.id);
      expect(read.metadata.title).toBe("Innocent id: ../../../PWNED");
      expect(read.metadata.parentId).toBe("main");
    });

    it("keeps every thread when creations run in parallel", async () => {
      await Promise.all(["A", "B", "C", "D", "E", "F"].map((title) => create(title)));

      const tree = await storage.readTree("proj");
      expect([...tree.nodes["main"].children].sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
    });

    it("never overwrites an unreadable thread file", async () => {
      const brokenPath = join(tempDir, "threads", "proj", "notes.md");
      await writeFile(brokenPath, "Hand-written notes without frontmatter");

      const node = await create("Notes");

      expect(node.metadata.id).toBe("notes-2");
      expect(await readFile(brokenPath, "utf-8")).toBe(
        "Hand-written notes without frontmatter"
      );
    });
  });

  describe("list", () => {
    it("renders nested levels with connectors", async () => {
      await create("Auth");
      await create("Auth UI", "auth");
      await create("Auth API", "auth");
      await create("Dashboard");
      await create("Charts", "dashboard");

      expect(await threadService.list("proj", "auth-ui")).toBe(
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
      await create("Feature");
      await create("Feature");
      await create("认证模块");

      expect(await threadService.list("proj", "thread")).toBe(
        [
          "main",
          "├── feature",
          "├── feature-2 — Feature",
          "└── thread — 认证模块 ← active",
        ].join("\n")
      );
    });

    it("shows status and linked branch", async () => {
      await threadService.create({
        projectId: "proj",
        parentId: "main",
        title: "Auth UI",
        author: "test-user",
        branch: "feature/auth-ui",
      });
      await create("GraphQL");
      await threadService.setStatus({
        projectId: "proj",
        threadId: "graphql",
        status: "abandoned",
        author: "test-user",
        mode: "solo",
      });

      expect(await threadService.list("proj", null)).toBe(
        [
          "main",
          "├── auth-ui [branch: feature/auth-ui]",
          "└── graphql [abandoned]",
        ].join("\n")
      );
    });
  });

  describe("updateSummary", () => {
    const update = (opts: Partial<Parameters<ThreadServiceImpl["updateSummary"]>[0]>) =>
      threadService.updateSummary({
        projectId: "proj",
        threadId: "main",
        content: "",
        author: "test-user",
        mode: "solo",
        ...opts,
      });

    it("updates thread content", async () => {
      await update({ content: "Updated summary." });

      const node = await storage.readThread("proj", "main");
      expect(node.content).toBe("Updated summary.");
    });

    it("rejects update from non-owner in team mode", async () => {
      await expect(
        update({ content: "Hack!", author: "other-user", mode: "team" })
      ).rejects.toThrow("Cannot update thread");
    });

    it("rejects threads that do not exist", async () => {
      await expect(update({ threadId: "ghost", content: "x" })).rejects.toThrow(
        'Thread "ghost" not found'
      );
    });

    it("lets the owner update a thread whose title contains ---", async () => {
      const node = await create("Refactor --- phase 2");

      await update({
        threadId: node.metadata.id,
        content: "New summary",
        mode: "team",
      });

      const read = await storage.readThread("proj", node.metadata.id);
      expect(read.metadata.title).toBe("Refactor --- phase 2");
      expect(read.metadata.parentId).toBe("main");
      expect(read.content).toBe("New summary");
    });

    it("adds to one section or replaces it", async () => {
      await update({ content: "## Decisions\n- JWT\n\n## State\n- Login done" });

      await update({ content: "- Refresh tokens", section: "decisions" });
      await update({ content: "- Logout done", section: "state", replaceSection: true });
      await update({ content: "- Rotate tokens?", section: "open-questions" });

      expect((await storage.readThread("proj", "main")).content).toBe(
        "## Decisions\n- JWT\n- Refresh tokens\n\n## State\n- Logout done\n\n## Open questions\n- Rotate tokens?"
      );
    });

    it("records the commit and the paths the summary covers", async () => {
      await update({ content: "x", commit: "a".repeat(40), paths: ["src/auth"] });
      let node = await storage.readThread("proj", "main");
      expect(node.metadata.commit).toBe("a".repeat(40));
      expect(node.metadata.paths).toEqual(["src/auth"]);

      // Paths are kept when not given, and cleared by an empty list
      await update({ content: "y" });
      expect((await storage.readThread("proj", "main")).metadata.paths).toEqual(["src/auth"]);
      await update({ content: "z", paths: [] });
      node = await storage.readThread("proj", "main");
      expect(node.metadata.paths).toBeUndefined();
    });
  });

  describe("setStatus", () => {
    it("closes a thread and records the reason in its decisions", async () => {
      await create("GraphQL");
      await threadService.setStatus({
        projectId: "proj",
        threadId: "graphql",
        status: "abandoned",
        reason: "REST is enough for our clients",
        author: "test-user",
        mode: "solo",
      });

      const node = await storage.readThread("proj", "graphql");
      expect(node.metadata.status).toBe("abandoned");
      expect(node.content).toBe(
        "## Decisions\n- Abandoned: REST is enough for our clients"
      );
    });

    it("reopens a thread", async () => {
      await create("Auth");
      const close = (status: "done" | "active") =>
        threadService.setStatus({
          projectId: "proj",
          threadId: "auth",
          status,
          author: "test-user",
          mode: "solo",
        });

      await close("done");
      await close("active");

      expect((await storage.readThread("proj", "auth")).metadata.status).toBeUndefined();
    });

    it("never closes the main thread", async () => {
      await expect(
        threadService.setStatus({
          projectId: "proj",
          threadId: "main",
          status: "done",
          author: "test-user",
          mode: "solo",
        })
      ).rejects.toThrow("The main thread cannot be closed");
    });
  });

  describe("merge", () => {
    it("replaces the parent's summary and marks the thread done", async () => {
      await create("Auth");
      const { parentId } = await threadService.merge({
        projectId: "proj",
        threadId: "auth",
        parentSummary: "## Decisions\n- Auth uses JWT",
        author: "test-user",
        mode: "solo",
      });

      expect(parentId).toBe("main");
      expect((await storage.readThread("proj", "main")).content).toBe(
        "## Decisions\n- Auth uses JWT"
      );
      const merged = await storage.readThread("proj", "auth");
      expect(merged.metadata.status).toBe("done");
      expect(merged.metadata.mergedInto).toBe("main");
    });

    it("needs to own the parent in team mode", async () => {
      await create("Auth", "main", "alice");

      await expect(
        threadService.merge({
          projectId: "proj",
          threadId: "auth",
          parentSummary: "x",
          author: "alice",
          mode: "team",
        })
      ).rejects.toThrow('Cannot update thread "main"');
      expect((await storage.readThread("proj", "auth")).metadata.status).toBeUndefined();
    });
  });

  describe("delete", () => {
    const remove = (threadId: string, author = "test-user", mode: "solo" | "team" = "solo") =>
      threadService.delete({ projectId: "proj", threadId, author, mode });

    it("deletes a thread and its descendants", async () => {
      await create("Parent");
      await create("Child", "parent");

      expect((await remove("parent")).sort()).toEqual(["child", "parent"]);

      const tree = await storage.readTree("proj");
      expect(tree.nodes["parent"]).toBeUndefined();
      expect(tree.nodes["child"]).toBeUndefined();
      expect(tree.nodes["main"].children).not.toContain("parent");
    });

    it("cannot delete main thread", async () => {
      await expect(remove("main")).rejects.toThrow("Cannot delete the main thread");
    });

    it("rejects threads that are not in the tree", async () => {
      await expect(remove("ghost")).rejects.toThrow('Thread "ghost" not found');
    });

    it("refuses to cascade over teammates' threads in team mode", async () => {
      await create("Mine", "main", "alice");
      await create("Theirs", "mine", "bob");

      await expect(remove("mine", "alice", "team")).rejects.toThrow("theirs (bob)");

      const tree = await storage.readTree("proj");
      expect(tree.nodes["mine"]).toBeDefined();
      expect(tree.nodes["theirs"]).toBeDefined();
    });
  });

  describe("rebase", () => {
    const rebase = (threadId: string, newParentId: string, author = "test-user", mode: "solo" | "team" = "solo") =>
      threadService.rebase({ projectId: "proj", threadId, newParentId, author, mode });

    it("moves a thread and its descendants to a new parent", async () => {
      await create("Feature A");
      await create("Deep", "feature-a");
      await create("Feature B");

      await rebase("feature-a", "feature-b");

      const tree = await storage.readTree("proj");
      expect(tree.nodes["feature-b"].children).toContain("feature-a");
      expect(tree.nodes["feature-a"].children).toEqual(["deep"]);
      expect(tree.nodes["main"].children).not.toContain("feature-a");
      expect((await storage.readThread("proj", "feature-a")).metadata.parentId).toBe("feature-b");
    });

    it("throws when attempting to create a circular reference", async () => {
      await create("Parent");
      await create("Child", "parent");

      await expect(rebase("parent", "child")).rejects.toThrow("is a descendant of");
    });

    it("cannot rebase the main thread", async () => {
      await create("Other");
      await expect(rebase("main", "other")).rejects.toThrow("Cannot rebase the main thread");
    });

    it("rejects rebase from non-owner in team mode", async () => {
      await create("Feature A", "main", "alice");
      await create("Feature B", "main", "bob");

      await expect(rebase("feature-a", "feature-b", "bob", "team")).rejects.toThrow(
        "Cannot rebase thread"
      );
    });
  });
});
