#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { runHook } from "./hooks/index.js";

async function main(): Promise<void> {
  // `thread-mind-mcp hook <event>` runs a Claude Code hook instead of the server
  const [command, event] = process.argv.slice(2);
  if (command === "hook") {
    await runHook(event);
    return;
  }

  const { server } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
