import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  commitsSince,
  currentBranch,
  headCommit,
  isBaseBranch,
} from "../../src/core/git.js";
import { commitFile, git } from "../helpers/git.js";

let repo: string;

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "threadmind-git-"));
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("git helpers", () => {
  it("returns nothing outside a repository", async () => {
    expect(await currentBranch(repo)).toBeNull();
    expect(await headCommit(repo)).toBeNull();
  });

  it("reads the checked-out branch", async () => {
    git(repo, "init", "-q", "-b", "main");
    expect(await currentBranch(repo)).toBe("main");

    await commitFile(repo, "a.txt", "1");
    git(repo, "checkout", "-q", "-b", "feature/auth-ui");
    expect(await currentBranch(join(repo))).toBe("feature/auth-ui");
  });

  it("reads the branch from a subdirectory and in a worktree", async () => {
    git(repo, "init", "-q", "-b", "main");
    await commitFile(repo, "src/a.txt", "1");
    expect(await currentBranch(join(repo, "src"))).toBe("main");

    const worktree = join(repo, "wt");
    git(repo, "worktree", "add", "-q", "-b", "feature/x", worktree);
    expect(await currentBranch(worktree)).toBe("feature/x");
  });

  it("returns no branch on a detached HEAD", async () => {
    git(repo, "init", "-q", "-b", "main");
    const commit = await commitFile(repo, "a.txt", "1");
    git(repo, "checkout", "-q", commit);
    expect(await currentBranch(repo)).toBeNull();
  });

  it("recognizes base branches", async () => {
    git(repo, "init", "-q", "-b", "main");
    expect(await isBaseBranch(repo, "main")).toBe(true);
    expect(await isBaseBranch(repo, "master")).toBe(true);
    expect(await isBaseBranch(repo, "feature/auth-ui")).toBe(false);
  });

  it("counts commits since a commit, optionally for some paths", async () => {
    git(repo, "init", "-q", "-b", "main");
    const first = await commitFile(repo, "src/auth/jwt.ts", "1");
    await commitFile(repo, "src/auth/jwt.ts", "2");
    await commitFile(repo, "docs/readme.md", "3");

    expect(await headCommit(repo)).toMatch(/^[0-9a-f]{40}$/);
    expect(await commitsSince(repo, first)).toBe(2);
    expect(await commitsSince(repo, first, ["src/auth"])).toBe(1);
    expect(await commitsSince(repo, first, ["src/api"])).toBe(0);
  });

  it("never passes a commit value that could be read as an option", async () => {
    git(repo, "init", "-q", "-b", "main");
    await commitFile(repo, "a.txt", "1");
    expect(await commitsSince(repo, "--output=pwned")).toBeNull();
    expect(await commitsSince(repo, "0123456789abcdef0123456789abcdef01234567")).toBeNull();
  });
});
