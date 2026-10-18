import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HOOK_EVENTS, type HookGuard } from "../hooks/guard.js";

/**
 * The tool the Claude Code plugin's hooks call (`type: "mcp_tool"`). Claude
 * Code reads its text like a command hook's output: a JSON hook output, or
 * nothing.
 */
export function registerHookTool(server: McpServer, guard: HookGuard): void {
  // Claude Code substitutes hook input values into strings
  const text = () => z.string().optional();

  server.registerTool(
    "threadmind_hook",
    {
      title: "Claude Code hook endpoint",
      description:
        "Internal: called by the ThreadMind hooks of Claude Code. Never call it yourself.",
      inputSchema: {
        event: z.enum(HOOK_EVENTS),
        session_id: text(),
        transcript_path: text(),
        source: text(),
        trigger: text(),
        stop_hook_active: z.union([z.boolean(), z.string()]).optional(),
        prompt: text(),
        file_path: text(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (call) => {
      try {
        const output = await guard.handle(call);
        return {
          content: output
            ? [{ type: "text" as const, text: JSON.stringify(output) }]
            : [],
        };
      } catch (error) {
        // Claude Code reports it as a non-blocking hook error
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `ThreadMind hook failed: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
