import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { HOOK_EVENTS } from "../../src/hooks/guard.js";

// Checks the files that ship the Claude Code plugin and the registry metadata
const repo = fileURLToPath(new URL("../..", import.meta.url));
const json = (path: string) =>
  JSON.parse(readFileSync(join(repo, path), "utf-8"));

const pkg = json("package.json");
const manifest = json("plugin/.claude-plugin/plugin.json");
const serverEntry = `\${CLAUDE_PLUGIN_ROOT}/node_modules/${pkg.name}/${pkg.main.replace(/^\.\//, "")}`;

describe("Claude Code plugin", () => {
  it("is listed by the repository's marketplace", () => {
    const marketplace = json(".claude-plugin/marketplace.json");
    const [entry] = marketplace.plugins;

    expect(entry.name).toBe(manifest.name);
    expect(existsSync(join(repo, entry.source, ".claude-plugin", "plugin.json"))).toBe(true);
  });

  it("installs the published server as a dependency", () => {
    expect(json("plugin/package.json").dependencies).toHaveProperty(pkg.name);
  });

  it("runs the installed server with node, its hook tool enabled", () => {
    const server = json("plugin/.mcp.json").mcpServers["thread-mind"];
    expect(server.command).toBe("node");
    expect(server.args).toEqual([serverEntry]);
    expect(server.env.THREADMIND_HOOKS).toBe("1");
  });

  it("passes every option the user sets to the server", () => {
    const { env } = json("plugin/.mcp.json").mcpServers["thread-mind"];
    const referenced = Object.values(env as Record<string, string>)
      .map((value) => /^\$\{user_config\.(\w+)\}$/.exec(value)?.[1])
      .filter(Boolean);

    expect(referenced.sort()).toEqual(Object.keys(manifest.userConfig).sort());
  });

  it("loads the context at session start and measures sessions", () => {
    const { hooks } = json("plugin/hooks/hooks.json");

    // MCP servers aren't available to hooks yet at startup
    const [startup, later] = hooks.SessionStart;
    expect(startup.matcher).toBe("startup");
    expect(startup.hooks[0]).toMatchObject({
      type: "command",
      command: "node",
      args: [serverEntry, "hook", "session-start"],
    });
    expect(later.matcher.split("|").sort()).toEqual(["clear", "compact"]);
    expect(later.hooks[0].input.event).toBe("session-start");

    expect(hooks.SessionEnd[0].hooks[0].args).toEqual([serverEntry, "hook", "session-end"]);
  });

  it("calls the plugin's own server from its MCP tool hooks", () => {
    const { hooks } = json("plugin/hooks/hooks.json");
    const [serverName] = Object.keys(json("plugin/.mcp.json").mcpServers);

    const toolHooks = Object.values(
      hooks as Record<string, { hooks: Record<string, any>[] }[]>
    )
      .flat()
      .flatMap((group) => group.hooks)
      .filter((hook) => hook.type === "mcp_tool");
    expect(toolHooks.length).toBeGreaterThanOrEqual(6);
    for (const hook of toolHooks) {
      expect(hook.server).toBe(`plugin:${manifest.name}:${serverName}`);
      expect(hook.tool).toBe("threadmind_hook");
      expect(HOOK_EVENTS).toContain(hook.input.event);
    }
    expect(Object.keys(hooks).sort()).toEqual([
      "PostToolUse",
      "PreCompact",
      "SessionEnd",
      "SessionStart",
      "Stop",
      "UserPromptSubmit",
    ]);
  });

  it("describes every command", () => {
    const dir = join(repo, "plugin", "commands");
    const commands = readdirSync(dir);
    expect(commands.length).toBeGreaterThan(0);
    for (const file of commands) {
      const content = readFileSync(join(dir, file), "utf-8");
      expect(content, file).toMatch(/^---\r?\ndescription: .+\r?\n/);
    }
  });
});

describe("MCP Registry metadata", () => {
  it("matches the npm package", () => {
    const server = json("server.json");
    expect(server.name).toBe(pkg.mcpName);
    expect(server.packages[0]).toMatchObject({
      registryType: "npm",
      identifier: pkg.name,
      transport: { type: "stdio" },
    });
    expect(server.description.length).toBeLessThanOrEqual(100);
  });
});
