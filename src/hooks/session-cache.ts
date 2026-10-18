import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** What the hooks know about a session's unsaved work, shown by the status line. */
export interface WatchState {
  projectId: string;
  threadId: string;
  /** Conversation growth in tokens since the thread's summary was saved */
  unsaved: number;
}

/**
 * Small per-session files through which the status line and the MCP server
 * share what each of them sees: the status line knows the context window
 * size, the server knows how much work is unsaved. Losing them is harmless.
 */
export class SessionCache {
  constructor(private readonly dir = join(tmpdir(), "thread-mind")) {}

  async writeWindow(sessionId: string, contextWindow: number): Promise<void> {
    await this.write(sessionId, "window", { contextWindow });
  }

  async readWindow(sessionId: string): Promise<number | null> {
    const data = await this.read(sessionId, "window");
    const size = data?.contextWindow;
    return typeof size === "number" && size > 0 ? size : null;
  }

  async writeWatch(sessionId: string, state: WatchState): Promise<void> {
    await this.write(sessionId, "watch", state);
  }

  async readWatch(sessionId: string): Promise<WatchState | null> {
    const data = await this.read(sessionId, "watch");
    if (
      typeof data?.projectId !== "string" ||
      typeof data.threadId !== "string" ||
      typeof data.unsaved !== "number"
    ) {
      return null;
    }
    return {
      projectId: data.projectId,
      threadId: data.threadId,
      unsaved: data.unsaved,
    };
  }

  private path(sessionId: string, kind: string): string | null {
    return SESSION_ID.test(sessionId)
      ? join(this.dir, `${sessionId}.${kind}.json`)
      : null;
  }

  private async write(sessionId: string, kind: string, data: object) {
    const path = this.path(sessionId, kind);
    if (!path) return;
    try {
      await mkdir(this.dir, { recursive: true });
      await writeFile(path, JSON.stringify(data));
    } catch {
      // Best effort: the status line just shows less
    }
  }

  private async read(
    sessionId: string,
    kind: string
  ): Promise<Record<string, unknown> | null> {
    const path = this.path(sessionId, kind);
    if (!path) return null;
    try {
      const parsed: unknown = JSON.parse(await readFile(path, "utf-8"));
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}
