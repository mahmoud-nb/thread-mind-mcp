#!/usr/bin/env node
// Run after `npm publish`: point the Claude Code plugin and the MCP Registry
// metadata at the version just published, refresh the plugin's lockfile
// (Claude Code installs the plugin's dependencies from it), then commit.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const { version } = readJson("package.json");

updateJson("plugin/package.json", (pkg) => {
  pkg.dependencies["thread-mind-mcp"] = version;
});
updateJson("plugin/.claude-plugin/plugin.json", (manifest) => {
  manifest.version = version;
});
updateJson("server.json", (server) => {
  server.version = version;
  for (const pkg of server.packages) pkg.version = version;
});

// npm is a .cmd script on Windows, which only a shell can run
execFileSync(
  "npm",
  ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"],
  { cwd: "plugin", stdio: "inherit", shell: process.platform === "win32" }
);
execFileSync("git", ["add", "plugin", "server.json"], { stdio: "inherit" });
execFileSync(
  "git",
  ["commit", "-m", `chore(plugin): use thread-mind-mcp ${version}`],
  { stdio: "inherit" }
);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function updateJson(path, change) {
  const data = readJson(path);
  change(data);
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}
