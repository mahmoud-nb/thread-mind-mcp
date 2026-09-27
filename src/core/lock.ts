import { readFile, stat, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

/** Critical sections take milliseconds: an older lock was left by a crashed process. */
const STALE_AFTER_MS = 10_000;
const TIMEOUT_MS = 15_000;

/**
 * Cross-process mutual exclusion based on an exclusively created lock file.
 * Resolves with a function that releases the lock. Not re-entrant.
 */
export async function acquireFileLock(
  lockPath: string
): Promise<() => Promise<void>> {
  const token = randomUUID();
  const deadline = Date.now() + TIMEOUT_MS;
  let lastCode: string | undefined;

  for (let attempt = 0; ; attempt++) {
    try {
      await writeFile(lockPath, token, { flag: "wx" });
      return () => releaseFileLock(lockPath, token);
    } catch (error) {
      lastCode = (error as NodeJS.ErrnoException).code;
      if (!isContention(lastCode)) throw error;
    }

    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for the ThreadMind lock (${lockPath}, ${lastCode}). ` +
          "If no other session is running, delete this file."
      );
    }

    const age = await lockAge(lockPath);
    if (age !== null && age > STALE_AFTER_MS && (await tryUnlink(lockPath))) {
      continue;
    }
    await delay(Math.min(5 * 2 ** attempt, 100));
  }
}

function isContention(code: string | undefined): boolean {
  if (code === "EEXIST") return true;
  // Windows reports these while a previous lock file is still being deleted
  return (
    process.platform === "win32" &&
    (code === "EPERM" || code === "EACCES" || code === "EBUSY")
  );
}

async function lockAge(lockPath: string): Promise<number | null> {
  try {
    return Date.now() - (await stat(lockPath)).mtimeMs;
  } catch {
    return null;
  }
}

async function tryUnlink(path: string): Promise<boolean> {
  try {
    await unlink(path);
    return true;
  } catch {
    return false;
  }
}

async function releaseFileLock(lockPath: string, token: string): Promise<void> {
  try {
    // Only remove the lock if it is still ours (it may have been reclaimed as stale)
    if ((await readFile(lockPath, "utf-8")) === token) {
      await unlink(lockPath);
    }
  } catch {
    // Already released
  }
}
