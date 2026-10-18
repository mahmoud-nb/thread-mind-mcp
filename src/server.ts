import { createRequire } from "node:module";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RootsListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { createServices } from "./services.js";
import { serverInstructions } from "./core/instructions.js";
import {
  DATA_DIR_NAME,
  Workspace,
  pathsFromRootUris,
} from "./core/workspace.js";
import { registerTools } from "./tools/index.js";
import { registerHookTool } from "./tools/hook.js";
import { HookGuard } from "./hooks/guard.js";
import { hookSettings, hooksEnabled } from "./hooks/settings.js";
import type { SessionCache } from "./hooks/session-cache.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import type { Services } from "./types/index.js";

// Resolves to the package root from both src/ (dev, tests) and dist/ (published)
const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

/**
 * @param basePath fixed .threadmind directory; when omitted, it is resolved
 * from THREADMIND_ROOT, the client's roots, or the working directory
 * @param options.env environment holding the Claude Code hook settings
 * @param options.hookCache where the hooks share state with the status line
 */
export function createServer(
  basePath?: string,
  options: { env?: NodeJS.ProcessEnv; hookCache?: SessionCache } = {}
): {
  server: McpServer;
  services: Services;
  guard: HookGuard;
} {
  const env = options.env ?? process.env;
  const server = new McpServer(
    {
      name: "thread-mind",
      version,
    },
    { instructions: serverInstructions() }
  );

  const workspace = new Workspace(async () => {
    if (!server.server.getClientCapabilities()?.roots) return [];
    const { roots } = await server.server.listRoots(undefined, {
      timeout: 5000,
    });
    return pathsFromRootUris(roots.map((root) => root.uri));
  });
  server.server.setNotificationHandler(
    RootsListChangedNotificationSchema,
    async () => workspace.reset()
  );

  const services: Services = createServices(
    basePath ?? (async () => join(await workspace.getRoot(), DATA_DIR_NAME))
  );

  const guard = new HookGuard(services, hookSettings(env), options.hookCache);

  registerTools(server, services, guard);
  // Only the Claude Code plugin calls it: other clients don't see it
  if (hooksEnabled(env)) registerHookTool(server, guard);
  registerResources(server, services);
  registerPrompts(server, services);

  return { server, services, guard };
}
