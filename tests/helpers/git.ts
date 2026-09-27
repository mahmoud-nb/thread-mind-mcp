import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Run git in a test repository, with a fixed identity. */
export function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args],
    { cwd, encoding: "utf-8" }
  ).trim();
}

/** Write a file, commit it, and return the new HEAD. */
export async function commitFile(
  cwd: string,
  path: string,
  content: string
): Promise<string> {
  await mkdir(dirname(join(cwd, path)), { recursive: true });
  await writeFile(join(cwd, path), content);
  git(cwd, "add", path);
  git(cwd, "commit", "-q", "-m", `change ${path}`);
  return git(cwd, "rev-parse", "HEAD");
}
