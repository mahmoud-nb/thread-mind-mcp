# Setting up the ThreadMind MCP server

Show the user the section for their agent. Don't change their configuration or install anything unless they ask you to.

## What gets installed

- **Package:** `thread-mind-mcp` on npm, MIT license. Source: https://github.com/mahmoud-nb/thread-mind-mcp
- **How it runs:** the agent starts it as a local stdio MCP server with `npx -y thread-mind-mcp`. The first start downloads the package from the npm registry; it needs Node.js 18 or later.
- **What it touches:** only the `.threadmind/` directory at the root of the project. The server makes no network calls and needs no account or API key.

## Claude Code

The recommended setup is the ThreadMind plugin. It also loads the context when a session starts and reminds the AI to save the summary:

```
/plugin marketplace add mahmoud-nb/thread-mind-mcp
/plugin install thread-mind@thread-mind
```

Without the plugin, from the root of the project:

```bash
claude mcp add --scope project thread-mind -- npx -y thread-mind-mcp
```

On native Windows, wrap `npx` in `cmd /c`: `claude mcp add --scope project thread-mind -- cmd /c npx -y thread-mind-mcp`.

## Shared `.mcp.json` (Claude Code, VS Code, GitHub Copilot CLI)

These three agents read the `.mcp.json` file at the root of the repository. Committing it sets up the whole team:

```json
{
  "mcpServers": {
    "thread-mind": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

## Cursor

`.cursor/mcp.json` in the project, or `~/.cursor/mcp.json` for every project:

```json
{
  "mcpServers": {
    "thread-mind": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

Then enable the server in **Customize**, in Cursor's sidebar.

## VS Code (GitHub Copilot)

The shared `.mcp.json` above, or `.vscode/mcp.json` (its top-level key is `servers`):

```json
{
  "servers": {
    "thread-mind": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

## GitHub Copilot CLI

The shared `.mcp.json` above, or for every project:

```bash
copilot mcp add thread-mind -- npx -y thread-mind-mcp
```

## Codex

The CLI, the IDE extension and the desktop app share one configuration:

```bash
codex mcp add thread-mind -- npx -y thread-mind-mcp
```

Or in `~/.codex/config.toml` (`.codex/config.toml` for one trusted project):

```toml
[mcp_servers.thread-mind]
command = "npx"
args = ["-y", "thread-mind-mcp"]
startup_timeout_sec = 30
```

## Gemini CLI

`.gemini/settings.json` in the project, or `~/.gemini/settings.json` for every project:

```json
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

Gemini CLI only connects to stdio servers in trusted folders: `gemini mcp list` shows whether ThreadMind is connected.

## Windsurf (Devin Desktop)

`~/.config/devin/mcp_config.json` on macOS and Linux, `%APPDATA%\devin\mcp_config.json` on Windows (earlier Windsurf versions: `~/.codeium/windsurf/mcp_config.json`):

```json
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

## Claude Desktop (chat)

A chat has no project folder: set `THREADMIND_ROOT` to the project's path. **Settings › Developer › Edit Config** opens `claude_desktop_config.json` (`~/Library/Application Support/Claude/` on macOS, `%APPDATA%\Claude\` on Windows):

```json
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"],
      "env": { "THREADMIND_ROOT": "/Users/you/projects/my-app" }
    }
  }
}
```

On Windows, write the path with doubled backslashes: `"C:\\Users\\you\\projects\\my-app"`. Then quit Claude Desktop completely and start it again. Each entry serves one project; for another one, add an entry with another name. The desktop app's **Code** tab runs Claude Code: use the plugin there.

## Windows

If the agent can't start `npx` on native Windows, run it through `cmd`: `"command": "cmd"` with `"args": ["/c", "npx", "-y", "thread-mind-mcp"]`.

## Check the setup

1. Restart the agent, then ask for `tm:tree`: the agent should call `thread_list`.
2. In a repository without a project, create one with `tm:project <title>`.
3. Check that `.threadmind/` appeared at the root of the project. If it appeared elsewhere, start the agent from the project, or set the `THREADMIND_ROOT` environment variable to the project's path in the server's configuration.

Each agent's full setup: https://mahmoud-nb.github.io/thread-mind-mcp/guide/other-clients
