import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/** Long-lived branches: threads are never linked to them. */
const BASE_BRANCHES = new Set(["main", "master", "develop", "dev", "trunk"]);

const COMMIT_PATTERN = /^[0-9a-f]{7,64}$/;

function git(cwd: string, args: string[]): Promise<string | null> {
  return new Promise((done) => {
    execFile(
      "git",
      args,
      { cwd, timeout: 5000, windowsHide: true },
      (error, stdout) => done(error ? null : stdout.trim())
    );
  });
}

/** The git directory of a working tree, following worktree and submodule links. */
export async function findGitDir(cwd: string): Promise<string | null> {
  let dir = resolve(cwd);
  for (;;) {
    const dotGit = join(dir, ".git");
    try {
      const info = await stat(dotGit);
      if (info.isDirectory()) return dotGit;
      const link = /^gitdir:\s*(.+)$/m.exec(await readFile(dotGit, "utf-8"));
      if (link) return resolve(dir, link[1].trim());
    } catch {
      // No .git here
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** The checked-out branch, or null outside git and on a detached HEAD. */
export async function currentBranch(cwd: string): Promise<string | null> {
  const gitDir = await findGitDir(cwd);
  if (!gitDir) return null;
  try {
    const head = (await readFile(join(gitDir, "HEAD"), "utf-8")).trim();
    return /^ref:\s*refs\/heads\/(.+)$/.exec(head)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Whether a branch is a base branch (main, master… or the remote's default). */
export async function isBaseBranch(cwd: string, branch: string): Promise<boolean> {
  if (BASE_BRANCHES.has(branch)) return true;
  const remoteHead = await git(cwd, [
    "symbolic-ref",
    "--quiet",
    "--short",
    "refs/remotes/origin/HEAD",
  ]);
  return remoteHead === `origin/${branch}`;
}

export async function headCommit(cwd: string): Promise<string | null> {
  const commit = await git(cwd, ["rev-parse", "HEAD"]);
  return commit && COMMIT_PATTERN.test(commit) ? commit : null;
}

/**
 * Commits reachable from HEAD but not from `commit`, optionally limited to
 * some paths. Null when the commit is unknown to this repository.
 */
export async function commitsSince(
  cwd: string,
  commit: string,
  paths: string[] = []
): Promise<number | null> {
  // The value comes from a thread file: never let it be read as an option
  if (!COMMIT_PATTERN.test(commit)) return null;
  const count = await git(cwd, [
    "rev-list",
    "--count",
    `${commit}..HEAD`,
    "--",
    ...paths,
  ]);
  return count === null ? null : Number(count);
}
