import { StorageServiceImpl } from "./core/storage.js";
import { ProjectServiceImpl } from "./core/project.js";
import { ThreadServiceImpl } from "./core/thread.js";
import { ContextServiceImpl } from "./core/context.js";
import { StatsServiceImpl } from "./core/stats.js";
import { SessionServiceImpl } from "./core/session.js";
import type { Services } from "./types/index.js";

/**
 * Services over one .threadmind directory, shared by the MCP server and the
 * Claude Code hooks.
 */
export function createServices(
  basePath?: string | (() => Promise<string>)
): Services {
  const storage = new StorageServiceImpl(basePath);
  return {
    storage,
    project: new ProjectServiceImpl(storage),
    thread: new ThreadServiceImpl(storage),
    context: new ContextServiceImpl(storage),
    stats: new StatsServiceImpl(storage),
    session: new SessionServiceImpl(storage),
  };
}
