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

### 2. Work on a topic and summarize

Have your normal conversation about the topic, then save a summary:

```
You: [discuss authentication approaches with AI...]
You: Summarize what we decided into the current thread

AI:  [calls summary_update]
     ✓ Summary updated for thread "main".
```

### 3. Branch into sub-topics

```
You: Create a thread called "API Routes"

AI:  [calls thread_create]
     ✓ Thread "api-routes" created under "main".

     main
     └── api-routes ← active
```

### 4. Check the assembled context

```
You: Show me the current ThreadMind context

AI:  [calls context_get]
     ## System Context
     We are building a Next.js e-commerce application

     ---

     ## Thread: My Web App
     Authentication: using JWT with refresh tokens...

     ---

     ## Thread: API Routes (active)
     [empty — start discussing and summarize later]
```

### 5. View your thread tree

```
You: Show the thread tree

AI:  [calls thread_list]
     main
     ├── api-routes ← active
     └── database-schema
```

## Recommended Workflow

1. **Create a project** at the start of a new codebase or feature
2. **Work in the main thread** for initial planning and broad decisions
3. **Branch** when you dive into a specific sub-topic
4. **Summarize** after each meaningful discussion — keep summaries concise (5-15 lines)
5. **Switch threads** when changing topics
6. **Use `context_get`** to feed the AI your structured context instead of relying on raw history

::: tip
Good summaries are the key to ThreadMind's effectiveness. Focus on **decisions, outcomes, and key technical choices** — not on the conversation itself.
:::

## Next Steps

- [Projects](/guide/projects) — project management in detail
- [Threads](/guide/threads) — creating and managing threads
- [Context Assembly](/guide/context-assembly) — how context is built from the tree
