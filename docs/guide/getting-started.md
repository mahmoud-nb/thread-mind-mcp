# Getting Started

## Prerequisites

- **Node.js** 18 or higher
- An **MCP-compatible AI client** (Claude Code, or any client supporting MCP)
- **Git** (optional: team mode, thread–branch links and outdated summary warnings)

## Installation

ThreadMind requires no global installation. It runs via `npx`:

```bash
npx thread-mind-mcp
```

## Configuration

### Which setup should I use?

| Situation | Recommended approach |
|-----------|---------------------|
| Claude Code | [The ThreadMind plugin](#claude-code-plugin-recommended) |
| Claude Code without the plugin, personal use | [Global — `~/.claude/settings.json`](#global-personal-all-projects) |
| Claude Code without the plugin, team project | [Project — `.mcp.json`](#per-project-team-mcp-json) |
| Cursor, Windsurf, or other MCP client | [Other MCP clients](#other-mcp-clients) |

---

### Claude Code plugin (recommended)

```
/plugin marketplace add mahmoud-nb/thread-mind-mcp
/plugin install thread-mind@thread-mind
```

The plugin installs the server and loads the active thread's context at the start of every session, after `/clear` and after compaction. See [Claude Code Plugin](/guide/claude-code-plugin). The manual configurations below are alternatives: don't combine them with the plugin.

---

### Claude Code — Global (personal, all projects)

Available in every project without any per-project setup. Recommended if you're the only one on the project or want ThreadMind everywhere.

**Via CLI (easiest):**

::: code-group

```bash [macOS / Linux]
claude mcp add thread-mind -- npx -y thread-mind-mcp
```

```bash [Windows]
claude mcp add thread-mind -- cmd /c npx -y thread-mind-mcp
```

:::

**Or manually** in `~/.claude/settings.json`:

::: code-group

```json [macOS / Linux]
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

```json [Windows]
{
  "mcpServers": {
    "thread-mind": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "thread-mind-mcp"],
      "env": {}
    }
  }
}
```

:::

---

### Claude Code — Per-project / Team (`.mcp.json`)

Creates a `.mcp.json` file at the project root. **Commit it to git** — teammates automatically get the MCP configured when they pull, with no manual setup required.

**Via CLI (easiest):**

::: code-group

```bash [macOS / Linux]
claude mcp add thread-mind --scope project -- npx -y thread-mind-mcp
```

```bash [Windows]
claude mcp add thread-mind --scope project -- cmd /c npx -y thread-mind-mcp
```

:::

This creates a `.mcp.json` at your project root:

::: code-group

```json [macOS / Linux]
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

```json [Windows]
{
  "mcpServers": {
    "thread-mind": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "thread-mind-mcp"],
      "env": {}
    }
  }
}
```

:::

::: tip
`.mcp.json` is different from `.claude/settings.json`. The latter stores personal Claude Code preferences (permissions, hooks) and is typically gitignored. `.mcp.json` is specifically for shared MCP server configuration.
:::

---

### Other MCP Clients

ThreadMind uses the standard **stdio MCP transport** and works with any compatible client — Cursor, Windsurf, Continue, and others. Add it to your client's MCP configuration file:

::: code-group

```json [macOS / Linux]
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

```json [Windows]
{
  "mcpServers": {
    "thread-mind": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "thread-mind-mcp"],
      "env": {}
    }
  }
}
```

:::

Refer to your client's documentation for the exact config file location.

::: tip
After any config change, **fully restart your AI client** for MCP changes to take effect.
:::

::: details Windows with Volta (Node.js version manager)
If you use **Volta**, its `npx` shim may not resolve when your AI client spawns subprocesses — the subprocess inherits the system PATH, not your shell session PATH. Use `volta run` to explicitly delegate version resolution:

```json
{
  "mcpServers": {
    "thread-mind": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "volta", "run", "npx", "-y", "thread-mind-mcp"],
      "env": {}
    }
  }
}
```

Via CLI: `claude mcp add thread-mind -- cmd /c volta run npx -y thread-mind-mcp`
:::

### Workspace location

ThreadMind stores its data in `.threadmind/` at the root of your workspace, found in this order:

1. The `THREADMIND_ROOT` environment variable, if set
2. The workspace roots advertised by your MCP client (a root that already contains `.threadmind/` wins)
3. The directory the server was started from — your project, with Claude Code

A client that starts servers outside your project without advertising roots needs `THREADMIND_ROOT`:

```json
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"],
      "env": { "THREADMIND_ROOT": "/path/to/your/project" }
    }
  }
}
```

## Your First Project

Once ThreadMind is configured, start a conversation with your AI and use the tools:

### 1. Create a project

```
You: Create a ThreadMind project called "My Web App" with system context
     "We are building a Next.js e-commerce application"

AI:  [calls project_create]
     ✓ Project "my-web-app" created (mode: solo). Main thread active.
```

### 2. Set up other agents (optional)

The server sends its usage instructions to your AI client when it connects, including the `tm:` shortcuts: Claude Code loads the context at the start of each session with no setup file.

For agents that don't read MCP server instructions, generate an `AGENTS.md` file (read by Codex, Cursor, GitHub Copilot and others):

```
You: tm:init

AI:  [calls threadmind_init]
     ✓ Generated AGENTS.md, .threadmind/instructions.md
```

::: tip
If an earlier version generated a ThreadMind section in `CLAUDE.md`, delete it: Claude Code now receives the same instructions from the server, and would otherwise load them twice. `threadmind_init` reports such leftovers.
:::

### 3. Work on a topic and summarize

Have your normal conversation about the topic, then save a summary:

```
You: [discuss authentication approaches with AI...]
You: tm:summary

AI:  [writes the summary in sections, then calls summary_update]
     ✓ Summary updated for thread "main".
```

Later, a single decision can be added without rewriting everything: `summary_update` with `section: "decisions"`.

### 4. Branch into sub-topics

```
You: tm:create API Routes

AI:  [calls thread_create]
     ✓ Thread "api-routes" created under "main".

     main
     └── api-routes ← active
```

On a feature branch, the thread is linked to it: whenever the branch is checked out, it becomes the active thread.

### 5. Start fresh when the conversation grows

When the conversation gets long, save the summary and run `/clear`. With the plugin, the new session starts with the thread's context:

```
## Thread: My Web App

## Decisions
- Next.js 15, PostgreSQL, Stripe

---

## Thread: API Routes (active)

## State
- Routes for products and cart done

---
_ThreadMind context: ~180 tokens | depth: 2 threads_
```

Without the plugin, ask for `tm:context` in the new session.

### 6. View your thread tree

```
You: tm:tree

AI:  [calls thread_list]
     main
     ├── api-routes ← active
     └── database-schema
```

### 7. Finish a thread

```
You: tm:merge

AI:  [writes the parent's new summary, then calls thread_merge]
     ✓ Thread "api-routes" merged into "main", which is now the active thread.
```

### 8. Check the numbers

```
You: tm:stats

AI:  [calls stats_show]
     Measured sessions (Claude Code plugin):
       Conversation size when sessions ended: ~48,200 tokens on average
       ThreadMind context loaded at session start: ~1,150 tokens on average
```

## Quick Shortcuts Reference

You can type these shortcuts directly in chat (the server instructions teach them to the AI):

| Command | Action |
|---------|--------|
| `tm:help` | Show all available commands |
| `tm:context` | Load assembled context |
| `tm:tree` | Show thread tree |
| `tm:create <title>` | Create a new thread |
| `tm:switch <id>` | Switch to a thread |
| `tm:rebase` | Move a thread to a different parent (like `git rebase`) |
| `tm:summary` | Write and save the summary |
| `tm:summary <content>` | Save specific summary content |
| `tm:merge` | Fold the thread into its parent |
| `tm:done [reason]` | Mark the thread done |
| `tm:abandon <reason>` | Mark the thread abandoned |
| `tm:stats` | Show statistics |
| `tm:delete <id>` | Delete a thread |
| `tm:init` | Generate instruction files |
| `tm:project <title>` | Create a new project |
| `tm:projects` | List all projects |

These also work as MCP Prompts (slash commands) in Claude Code: `/mcp__thread-mind__tm-help`, etc.

## Recommended Workflow

1. **Create a project** at the start of a new codebase or feature
2. **Work in the main thread** for initial planning and broad decisions
3. **Branch** when you dive into a specific sub-topic (`tm:create <title>`), ideally on its git branch
4. **Record decisions** as they happen (`tm:summary`)
5. **Start fresh** with `/clear` when the conversation grows: the thread's context carries over
6. **Switch threads** when changing topics (`tm:switch <id>`)
7. **Merge or close** finished threads (`tm:merge`, `tm:done`, `tm:abandon`)
8. **Check the numbers** with `tm:stats`

::: tip
Good summaries are the key to ThreadMind's effectiveness. Put what must stay true in **Decisions** and **Constraints**: that is what child threads inherit.
:::

## Next Steps

- [Projects](/guide/projects) — project management in detail
- [Threads](/guide/threads) — creating and managing threads
- [Context Assembly](/guide/context-assembly) — how context is built from the tree
