# Other AI Clients

ThreadMind works with any MCP client that runs stdio servers. Three things differ from one client to another:

- **Where the server is declared**: each client has its own configuration file
- **How the AI learns to use ThreadMind**: from the instructions the server sends when it connects, or from an `AGENTS.md` file for clients that don't read them
- **How the server finds your project**: from the workspace folders the client advertises (MCP roots), or else from the directory the server starts in

For Claude Code, use the [plugin](/guide/claude-code-plugin) instead.

## At a glance

| Client | Server configuration | Usage instructions | Project folder |
|--------|----------------------|--------------------|----------------|
| [Cursor](#cursor) | `.cursor/mcp.json` or `~/.cursor/mcp.json` | `AGENTS.md` | Advertised by Cursor |
| [VS Code (GitHub Copilot)](#vs-code-github-copilot) | `.vscode/mcp.json` or `.mcp.json` | Sent by the server | Advertised by VS Code |
| [GitHub Copilot CLI](#github-copilot-cli) | `.mcp.json` or `~/.copilot/mcp-config.json` | `AGENTS.md` | Start directory |
| [Codex](#codex) | `~/.codex/config.toml` or `.codex/config.toml` | Sent by the server | Start directory |
| [Gemini CLI](#gemini-cli) | `.gemini/settings.json` or `~/.gemini/settings.json` | Sent by the server | Start directory |
| [Windsurf](#windsurf) | `mcp_config.json` | `AGENTS.md` | [Check it](#check-the-setup) |

To generate `AGENTS.md`, ask the AI for `tm:init` once the server is set up: it calls `threadmind_init`. Commit the file so that the whole team gets it.

The `tm:` shortcuts work in every client, since they are part of the usage instructions.

## Share one configuration with the team

Claude Code, VS Code and GitHub Copilot CLI all read the `.mcp.json` file at the root of the repository. Commit it and these three clients get ThreadMind:

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

Each client starts a server declared by a repository only once you trust it: Claude Code asks you to approve the server, VS Code and Copilot CLI rely on workspace and folder trust.

::: tip Windows
Some clients can't start `npx` directly on native Windows, because it is a `.cmd` script. If the server doesn't start, run it through `cmd`: `"command": "cmd"` with `"args": ["/c", "npx", "-y", "thread-mind-mcp"]`. Claude Code needs this; its [plugin](/guide/claude-code-plugin) doesn't. If you use the plugin in a repository that also has `.mcp.json`, decline the repository's server when Claude Code asks, so that ThreadMind doesn't run twice.
:::

## Cursor

Declare the server in `.cursor/mcp.json` at the root of the project (commit it to share it), or in `~/.cursor/mcp.json` for every project:

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

Then check that the server is enabled in **Customize**, in Cursor's sidebar. Cursor asks for approval before running MCP tools; you can allow ThreadMind's tools so that the AI saves summaries without interrupting you.

**Usage instructions:** Cursor reads `AGENTS.md`, which `tm:init` generates. To keep ThreadMind out of `AGENTS.md`, generate a Cursor rule instead, `.cursor/rules/threadmind.mdc` (`threadmind_init` with `clients: ["cursor"]`), applied to every conversation. Keep only one of the two: with both, Cursor loads the instructions twice. Earlier versions wrote `.cursorrules`; generating the rule moves the ThreadMind section out of it.

**Project folder:** Cursor advertises the folders of the workspace, so the global configuration works for every project.

## VS Code (GitHub Copilot)

VS Code reads the shared [`.mcp.json`](#share-one-configuration-with-the-team). To keep the configuration to VS Code, use `.vscode/mcp.json`, whose top-level key is `servers`:

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

For every workspace, run **MCP: Open User Configuration** from the Command Palette and add the same entry.

**Usage instructions:** VS Code passes the instructions the server sends to Copilot: no file is needed.

**Project folder:** VS Code advertises the workspace folders, so the user configuration works for every workspace.

## GitHub Copilot CLI

Copilot CLI reads the shared [`.mcp.json`](#share-one-configuration-with-the-team) (or `.github/mcp.json`) once you trust the folder. To add ThreadMind for yourself, in every project:

```bash
copilot mcp add thread-mind -- npx -y thread-mind-mcp
```

This writes `~/.copilot/mcp-config.json`. Inside a session, `/mcp add` opens the same setting as a form.

**Usage instructions:** Copilot CLI reads `AGENTS.md`: generate it with `tm:init`.

**Project folder:** start Copilot CLI from the root of the project.

## Codex

The Codex CLI, its IDE extension and the desktop app share one configuration. Add ThreadMind with:

```bash
codex mcp add thread-mind -- npx -y thread-mind-mcp
```

This writes `~/.codex/config.toml`. You can also edit the file, or declare the server for a single project in `.codex/config.toml` (trusted projects only):

```toml
[mcp_servers.thread-mind]
command = "npx"
args = ["-y", "thread-mind-mcp"]
# The first start downloads the package: leave it time
startup_timeout_sec = 30
```

**Usage instructions:** Codex reads the instructions the server sends: no file is needed. Codex also reads `AGENTS.md`, if your team generates it for other agents.

**Project folder:** the server works in the directory Codex starts it from: start Codex from the root of the project. Otherwise, set the server's working directory with `cwd`.

## Gemini CLI

Declare the server in `.gemini/settings.json` at the root of the project (commit it to share it), or in `~/.gemini/settings.json` for every project:

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

Gemini CLI only connects to stdio servers in folders you trust: `gemini mcp list` shows whether ThreadMind is connected. ThreadMind's MCP prompts become slash commands, such as `/tm-tree`.

**Usage instructions:** Gemini CLI adds the instructions the server sends to its system instructions: no file is needed. Gemini CLI reads `GEMINI.md`, not `AGENTS.md`; to share one `AGENTS.md` with other agents, list it in `settings.json`:

```json
{
  "context": {
    "fileName": ["AGENTS.md", "GEMINI.md"]
  }
}
```

**Project folder:** start Gemini CLI from the root of the project. Otherwise, set the server's working directory with `cwd`.

## Windsurf

Windsurf, now Devin Desktop, reads MCP servers from `mcp_config.json`: `~/.config/devin/mcp_config.json` on macOS and Linux, `%APPDATA%\devin\mcp_config.json` on Windows. Earlier versions of Windsurf used `~/.codeium/windsurf/mcp_config.json`.

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

**Usage instructions:** Cascade applies the `AGENTS.md` at the root of the project to every conversation: generate it with `tm:init`.

**Project folder:** [check where ThreadMind stores its data](#check-the-setup). If it isn't in your project, set `THREADMIND_ROOT` (see [Workspace location](/guide/getting-started#workspace-location)).

## Other clients

Zed, Cline, Continue, JetBrains AI Assistant and other clients take the same command: `npx -y thread-mind-mcp`, as a stdio server. Look up where your client declares MCP servers, then [check the setup](#check-the-setup).

## Check the setup

In a new conversation:

1. Ask for **`tm:tree`**. The AI should call `thread_list`. If it doesn't know the shortcut, the client didn't get the usage instructions: generate `AGENTS.md` with `threadmind_init`.
2. In a repository without a project, the AI answers that there is no ThreadMind project yet: create one with `tm:project <title>`.
3. Check that the `.threadmind/` directory appeared at the root of **your project**. If it appeared elsewhere, such as your home directory, the client started the server outside the project without advertising it: start the client from the project, or set `THREADMIND_ROOT`.

## What only Claude Code does

The [Claude Code plugin](/guide/claude-code-plugin) loads the active thread's context when a session starts, reminds the AI to save the summary, recovers it after a compaction and follows git branch changes. Other clients rely on the usage instructions alone: the AI calls `context_get` when a conversation starts and `summary_update` after decisions. Ask for `tm:summary` before closing a long conversation, and `tm:context` when a new one doesn't start with your decisions.
