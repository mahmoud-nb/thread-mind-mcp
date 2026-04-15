import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StorageServiceImpl } from "./core/storage.js";
import { ProjectServiceImpl } from "./core/project.js";
import { ThreadServiceImpl } from "./core/thread.js";
import { ContextServiceImpl } from "./core/context.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import type { Services } from "./types/index.js";

export function createServer(basePath?: string): {
  server: McpServer;
  services: Services;
} {
  const storage = new StorageServiceImpl(basePath);
  const project = new ProjectServiceImpl(storage);
  const thread = new ThreadServiceImpl(storage);
  const context = new ContextServiceImpl(storage);

  const services: Services = { storage, project, thread, context };

  const server = new McpServer({
    name: "thread-mind",
    version: "0.2.0",
  });

  registerTools(server, services);
  registerResources(server, services);
  registerPrompts(server, services);

  return { server, services };
}
