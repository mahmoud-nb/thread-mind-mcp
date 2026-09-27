import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA_DIR_NAME = ".threadmind";

/**
 * Resolves the workspace root: THREADMIND_ROOT if set, else the roots the MCP
 * client advertises (preferring one that already contains .threadmind), else
 * the working directory. Resolution is lazy because client roots can only be
 * requested once the connection is initialized.
 */
export class Workspace {
  private root: Promise<string> | null = null;

  constructor(private readonly clientRoots: () => Promise<string[]>) {}

  getRoot(): Promise<string> {
    this.root ??= this.resolveRoot();
    return this.root;
  }

  /** Resolve again on next use, e.g. after the client's roots changed. */
  reset(): void {
    this.root = null;
  }

  private async resolveRoot(): Promise<string> {
    const fromEnv = process.env.THREADMIND_ROOT?.trim();
    if (fromEnv) return resolve(fromEnv);

    let roots: string[] = [];
    try {
      roots = await this.clientRoots();
    } catch {
      // Client without roots support, or the request failed
    }
    return (
      roots.find((root) => existsSync(join(root, DATA_DIR_NAME))) ??
      roots[0] ??
      process.cwd()
    );
  }
}

/** Convert root URIs to local paths, skipping anything but file:// URIs. */
export function pathsFromRootUris(uris: string[]): string[] {
  const paths: string[] = [];
  for (const uri of uris) {
    try {
      paths.push(fileURLToPath(uri));
    } catch {
      // Not a local file URI
    }
  }
  return paths;
}
