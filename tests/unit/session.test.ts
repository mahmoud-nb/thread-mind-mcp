import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServices } from "../../src/services.js";
import { SessionServiceImpl } from "../../src/core/session.js";
import type { Services } from "../../src/types/index.js";
import { commitFile, git } from "../helpers/git.js";

// Stands for the repository: ThreadMind data lives in root/.threadmind
let root: string;
let services: Services;

/** A new MCP session on the same workspace. */
const newSession = () => new SessionServiceImpl(services.storage);

async function setUpProject(): Promise<void> {
  const config = await services.project.create({ title: "Proj" });
  expect(config.id).toBe("proj");
  for (const title of ["Auth", "Billing"]) {
    await services.thread.create({
      projectId: "proj",
      parentId: "main",
      title,
      author: "me",
    });
  }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "threadmind-session-"));
  services = createServices(join(root, ".threadmind"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("SessionService", () => {
  describe("outside git", () => {
    it("has no active thread without a project", async () => {
      expect(await newSession().active()).toBeNull();
    });

    it("selects the only project after a fresh clone", async () => {
      await setUpProject();
      expect(await newSession().active()).toEqual({
        projectId: "proj",
        threadId: "main",
        branch: null,
        reason: "default",
      });
    });

    it("needs a selection when there are several projects", async () => {
      await setUpProject();
      await services.project.create({ title: "Other" });
      expect(await newSession().active()).toBeNull();
    });

    it("starts where the last session left off", async () => {
      await setUpProject();
      await newSession().selectThread("proj", "auth");

      expect(await newSession().active()).toMatchObject({
        threadId: "auth",
        reason: "last-used",
      });
    });

    it("keeps its own thread when another session switches", async () => {
      await setUpProject();
      const first = newSession();
      expect((await first.active())?.threadId).toBe("main");

      await newSession().selectThread("proj", "billing");

      expect((await first.active())?.threadId).toBe("main");
    });

    it("moves on when its thread is deleted", async () => {
      await setUpProject();
      const session = newSession();
      await session.selectThread("proj", "auth");
      await services.thread.delete({
        projectId: "proj",
        threadId: "auth",
        author: "me",
        mode: "solo",
      });

      expect((await session.active())?.threadId).toBe("main");
    });

    it("rejects unknown threads", async () => {
      await setUpProject();
      await expect(newSession().selectThread("proj", "ghost")).rejects.toThrow(
        'Thread "ghost" not found'
      );
    });
  });

  describe("on a git branch", () => {
    beforeEach(async () => {
      git(root, "init", "-q", "-b", "main");
      await commitFile(root, "README.md", "hello");
      await setUpProject();
    });

    it("remembers the last thread used on each branch", async () => {
      await newSession().selectThread("proj", "auth");
      git(root, "checkout", "-q", "-b", "feature/billing");
      await newSession().selectThread("proj", "billing");

      git(root, "checkout", "-q", "main");
      expect(await newSession().active()).toMatchObject({
        threadId: "auth",
        branch: "main",
        reason: "branch-memory",
      });
    });

    it("activates the thread linked to the checked-out branch", async () => {
      git(root, "checkout", "-q", "-b", "feature/auth-ui");
      const linked = await services.thread.create({
        projectId: "proj",
        parentId: "auth",
        title: "Auth UI",
        author: "me",
        branch: (await newSession().branchToLink("proj")) ?? undefined,
      });
      expect(linked.metadata.branch).toBe("feature/auth-ui");

      // A teammate who pulls the branch has no local history of it
      expect(await newSession().active()).toMatchObject({
        threadId: "auth-ui",
        reason: "branch",
      });
    });

    it("does not carry a thread linked to another branch", async () => {
      git(root, "checkout", "-q", "-b", "feature/auth-ui");
      await services.thread.create({
        projectId: "proj",
        parentId: "auth",
        title: "Auth UI",
        author: "me",
        branch: "feature/auth-ui",
      });
      await newSession().selectThread("proj", "auth-ui");

      git(root, "checkout", "-q", "-b", "feature/payments", "main");
      expect(await newSession().active()).toMatchObject({
        threadId: "main",
        reason: "default",
      });
    });

    it("follows a branch change during the session", async () => {
      const session = newSession();
      expect((await session.active())?.threadId).toBe("main");

      git(root, "checkout", "-q", "-b", "feature/auth-ui");
      await services.thread.create({
        projectId: "proj",
        parentId: "auth",
        title: "Auth UI",
        author: "me",
        branch: "feature/auth-ui",
      });

      expect((await session.active())?.threadId).toBe("auth-ui");
    });

    it("links new threads to feature branches only, once", async () => {
      const session = newSession();
      expect(await session.branchToLink("proj")).toBeNull();

      git(root, "checkout", "-q", "-b", "feature/x");
      expect(await session.branchToLink("proj")).toBe("feature/x");

      await services.thread.create({
        projectId: "proj",
        parentId: "main",
        title: "X",
        author: "me",
        branch: "feature/x",
      });
      expect(await session.branchToLink("proj")).toBeNull();

      // Closing the linked thread frees the branch
      await services.thread.setStatus({
        projectId: "proj",
        threadId: "x",
        status: "done",
        author: "me",
        mode: "solo",
      });
      expect(await session.branchToLink("proj")).toBe("feature/x");
    });
  });
});
