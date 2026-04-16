# Getting Started

## Prerequisites

- **Node.js** 18 or higher
- An **MCP-compatible AI client** (Claude Code, or any client supporting MCP)
- **Git** (optional, required for team mode)

## Installation

ThreadMind requires no global installation. It runs via `npx`:

```bash
npx thread-mind-mcp
```

## Configuration

### Claude Code

Add the following to your MCP settings file:

**Global** (`~/.claude/settings.json`):
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

**Per-project** (`.claude/settings.json` in your repo):
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

### Other MCP Clients

Any client supporting the MCP stdio transport can use ThreadMind with the same configuration pattern.

## Your First Project

Once ThreadMind is configured, start a conversation with your AI and use the tools:

### 1. Create a project

```
You: Create a ThreadMind project called "My Web App" with system context
     "We are building a Next.js e-commerce application"

AI:  [calls project_create]
     ✓ Project "my-web-app" created (mode: solo). Main thread active.
```

### 2. Generate instruction files

```
You: tm:init

AI:  [calls threadmind_init]
     ✓ Generated CLAUDE.md, .cursorrules, instructions.md
```

This generates instruction files that teach your AI client to use ThreadMind automatically — including `tm:` shortcuts you can type in chat.

::: tip
Always run `tm:init` (or `threadmind_init`) right after creating a project. The generated `CLAUDE.md` file tells Claude Code to proactively use ThreadMind at every session start.
:::

### 3. Work on a topic and summarize

Have your normal conversation about the topic, then save a summary:

```
You: [discuss authentication approaches with AI...]
You: tm:summary

AI:  [generates summary, then calls summary_update]
     ✓ Summary updated for thread "main".
```

### 4. Branch into sub-topics

```
You: tm:create API Routes

AI:  [calls thread_create]
     ✓ Thread "api-routes" created under "main".

     main
     └── api-routes ← active
```

### 5. Check the assembled context

```
You: tm:context

AI:  [calls context_get]
     ## System Context
     We are building a Next.js e-commerce application

     ---

     ## Thread: My Web App
     Authentication: using JWT with refresh tokens...

     ---

     ## Thread: API Routes (active)
     [empty — start discussing and summarize later]

     ---
     _ThreadMind context: ~180 tokens | depth: 2 threads_
     _Estimated raw history: ~3,400 tokens (~95% reduction from 4 summary updates)_
```

### 6. View your thread tree

```
You: tm:tree

AI:  [calls thread_list]
     main
     ├── api-routes ← active
     └── database-schema
```

### 7. Check token savings

```
You: tm:stats

AI:  [calls stats_show]
     ThreadMind Stats: "My Web App"

     Overview:
       Threads: 3 (2 with content)
       Summary updates: 4
       Current context: ~180 tokens (depth: 2)

     Token Savings (estimated):
       Estimated raw history: ~3,400 tokens
       ThreadMind context:    ~180 tokens
       Reduction:             ~95%
```

## Quick Shortcuts Reference

After running `threadmind_init`, you can type these shortcuts directly in chat:

| Command | Action |
|---------|--------|
| `tm:help` | Show all available commands |
| `tm:context` | Load assembled context |
| `tm:tree` | Show thread tree |
| `tm:create <title>` | Create a new thread |
| `tm:switch <id>` | Switch to a thread |
| `tm:summary` | Auto-generate and save a summary |
| `tm:summary <content>` | Save specific summary content |
| `tm:stats` | Show token savings statistics |
| `tm:delete <id>` | Delete a thread |
| `tm:init` | Generate instruction files |
| `tm:project <title>` | Create a new project |
| `tm:projects` | List all projects |

These also work as MCP Prompts (slash commands) in Claude Code: `/mcp__thread-mind__tm-help`, etc.

## Recommended Workflow

1. **Create a project** at the start of a new codebase or feature
2. **Run `tm:init`** to generate instruction files for your AI client
3. **Work in the main thread** for initial planning and broad decisions
4. **Branch** when you dive into a specific sub-topic (`tm:create <title>`)
5. **Summarize** after each meaningful discussion (`tm:summary`)
6. **Switch threads** when changing topics (`tm:switch <id>`)
7. **Use `tm:context`** to feed the AI your structured context instead of relying on raw history
8. **Check savings** with `tm:stats` to see how much context you're compressing

::: tip
Good summaries are the key to ThreadMind's effectiveness. Focus on **decisions, outcomes, and key technical choices** — not on the conversation itself.
:::

## Next Steps

- [Projects](/guide/projects) — project management in detail
- [Threads](/guide/threads) — creating and managing threads
- [Context Assembly](/guide/context-assembly) — how context is built from the tree
