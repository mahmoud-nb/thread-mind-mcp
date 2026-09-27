# ThreadMind MCP

[![npm version](https://img.shields.io/npm/v/thread-mind-mcp.svg)](https://www.npmjs.com/package/thread-mind-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Organize your AI conversations into thread trees. Think less tokens, think more.**

ThreadMind is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that structures AI conversations into hierarchical threads. Instead of feeding entire conversation histories to your AI model, ThreadMind lets you maintain concise summaries organized in a tree — drastically reducing token consumption while preserving full context.

> **[Documentation](https://mahmoud-nb.github.io/thread-mind-mcp/)** | **[npm](https://www.npmjs.com/package/thread-mind-mcp)** | **[GitHub](https://github.com/mahmoud-nb/thread-mind-mcp)**

---

## Why ThreadMind?

When working with AI coding assistants (Claude Code, ChatGPT, Gemini, etc.), conversations quickly grow long. Every new message sends the **entire history** as context, burning through tokens and hitting context limits. ThreadMind solves this by:

- **Replacing history with summaries** — each thread stores a concise summary instead of raw conversation
- **Inheriting context through the tree** — a child thread automatically includes its ancestors' summaries
- **Enabling branching exploration** — explore different approaches in separate threads without polluting each other
- **Supporting team collaboration** — share thread trees via git, branch from teammates' threads

### Before ThreadMind

```
Message 1 → Message 2 → ... → Message 50 → Message 51
                                              ↑
                              All 50 messages sent as context
                              = thousands of tokens wasted
```

### With ThreadMind

```
main (summary: 200 tokens)
├── auth (summary: 150 tokens)
│   └── auth-ui (summary: 100 tokens) ← active
└── dashboard (summary: 180 tokens)

Context sent = main + auth + auth-ui = ~450 tokens
```

---

## Quick Start

### Installation

No installation required — run directly with `npx`:

```bash
npx thread-mind-mcp
```

Or install globally:

```bash
npm install -g thread-mind-mcp
```

### Configure with Claude Code

Add to your Claude Code MCP settings (`~/.claude/settings.json` or project `.claude/settings.json`):

**macOS / Linux:**
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

**Windows:**
```json
{
  "mcpServers": {
    "thread-mind": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "thread-mind-mcp"],
      "env": {}
    }
  }
}
```

> On Windows, `npx` must be wrapped with `cmd /c` because `npx` is a `.cmd` wrapper and cannot be spawned directly by the MCP stdio transport.

**Windows + Volta:**

If you use Volta as your Node.js version manager, use `volta run` to ensure the correct Node.js version is resolved when Claude Code spawns the MCP subprocess:

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

Or via CLI: `claude mcp add thread-mind-mcp --scope project -- cmd /c volta run npx -y thread-mind-mcp`

### Configure with other MCP clients

ThreadMind uses the **stdio transport**, compatible with any MCP client. Use the same configuration above for your platform.

### Workspace location

ThreadMind stores its data in `.threadmind/` at the root of your workspace, found in this order:

1. The `THREADMIND_ROOT` environment variable, if set
2. The workspace roots advertised by the MCP client (a root that already contains `.threadmind/` wins)
3. The directory the server was started from

A client that starts servers outside your project without advertising roots (for example a desktop chat app with no project folder) needs `THREADMIND_ROOT`:

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

### Teach your AI client to use ThreadMind

The server sends its usage instructions when the client connects (MCP server instructions): Claude Code needs no setup file. For agents that don't read them, run `threadmind_init` to generate an `AGENTS.md` file, read by Codex, Cursor, GitHub Copilot and others.

---

## How It Works

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Project** | A workspace containing a thread tree. Has a title, system context, and mode (solo/team). |
| **Thread** | A node in the tree representing a discussion topic. Stores a markdown summary. |
| **Context** | The assembled chain of summaries from root to active thread — what gets sent to the AI. |
| **Summary** | A concise markdown description of what was discussed/decided in a thread. |

### Storage

ThreadMind stores everything in a `.threadmind/` directory at your project root:

```
.threadmind/
  config.json              # Local state (active project/thread, author ID)
  .gitignore               # Excludes config.json from git
  projects/
    my-app.json            # Project configuration
  threads/
    my-app/
      main.md              # Root thread (markdown + YAML frontmatter)
      auth-system.md       # Child thread
      auth-api.md          # Grandchild thread
  trees/
    my-app.json            # Tree structure index
```

Thread files use YAML frontmatter:

```markdown
---
id: auth-system
title: Authentication System
parentId: main
author: mahmoud-a3f9
createdAt: 2026-04-15T10:00:00Z
updatedAt: 2026-04-15T12:30:00Z
---

Implemented JWT-based authentication with refresh tokens.
Using bcrypt for password hashing. Session stored in httpOnly cookies.
Decision: chose Passport.js over custom middleware for maintainability.
```

### Context Assembly

When you request context, ThreadMind walks up from the active thread to the root, collecting summaries:

```
## System Context
You are building a Next.js e-commerce application...

---

## Thread: My App
Project overview: Next.js 15, PostgreSQL, Stripe integration...

---

## Thread: Authentication System
JWT-based auth with refresh tokens, bcrypt, Passport.js...

---

## Thread: Auth API Endpoints (active)
POST /auth/login, POST /auth/register, POST /auth/refresh...
```

Only the **direct ancestor chain** is included — sibling branches are excluded, keeping context minimal.

`context_get` also reports token estimation:
```
ThreadMind context: ~450 tokens | depth: 3 threads
```

---

## Available Tools

Each tool declares a title and MCP annotations (read-only, destructive, idempotent), which clients can use to decide when to ask for confirmation.

### Project Management

| Tool | Description |
|------|-------------|
| `project_create` | Create a new project with a root "main" thread |
| `project_list` | List all projects (shows active project) |
| `project_switch` | Switch to a different project |

#### `project_create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Project title (used to generate ID) |
| `systemContext` | string | No | System prompt or global instructions |
| `mode` | `"solo"` \| `"team"` | No | Project mode (default: `"solo"`) |

### Thread Management

| Tool | Description |
|------|-------------|
| `thread_create` | Create a child thread branching from a parent |
| `thread_switch` | Switch to a different thread and return its assembled context |
| `thread_list` | Display the thread tree as ASCII art |
| `thread_delete` | Delete a thread and all its descendants |
| `thread_rebase` | Move a thread to a different parent (like `git rebase`) |

#### `thread_create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Thread title (used to generate ID) |
| `parentId` | string | No | Parent thread ID (defaults to active thread) |

#### `thread_delete`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `threadId` | string | Yes | Thread ID to delete (cascades to descendants) |

#### `thread_rebase`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `threadId` | string | Yes | Thread ID to move |
| `newParentId` | string | Yes | New parent thread ID |

### Summary & Context

| Tool | Description |
|------|-------------|
| `summary_update` | Update the summary content of a thread |
| `context_get` | Get the full assembled context with token estimation |

#### `summary_update`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | New summary content (markdown) |
| `threadId` | string | No | Target thread (defaults to active thread) |

### Setup

| Tool | Description |
|------|-------------|
| `threadmind_init` | Generate instruction files for agents that don't read MCP server instructions (AGENTS.md, etc.) |

#### `threadmind_init`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clients` | string[] | No | Files to generate: `"agents"`, `"claude"`, `"cursor"`, `"generic"` (default: `agents` and `generic`) |

Writes the same instructions the server sends to MCP clients:

| Target | File | Read by |
|--------|------|---------|
| `agents` | `AGENTS.md` | Codex, Cursor, GitHub Copilot and other agents |
| `claude` | `CLAUDE.md` | Claude Code — not needed, it receives the server instructions |
| `cursor` | `.cursor/rules/threadmind.mdc` | Cursor, as an always-applied project rule |
| `generic` | `.threadmind/instructions.md` | Paste into any client's custom instructions |

Earlier versions wrote `CLAUDE.md` and `.cursorrules`. `threadmind_init` moves the ThreadMind section out of `.cursorrules` when it generates the Cursor rule, and reports any section left in either file.

### Statistics

| Tool | Description |
|------|-------------|
| `stats_show` | Show token savings statistics (compression ratio, per-thread breakdown) |

`stats_show` tracks every `summary_update` call and computes estimated token savings by comparing cumulative input against the current assembled context.

---

## Available Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Current Context | `threadmind://context` | Assembled context for the active thread |
| Thread Tree | `threadmind://tree` | ASCII visualization of the thread tree |
| Thread Summary | `threadmind://thread/{threadId}` | Summary of one thread, without its ancestors |

Every thread of the active project is listed as a resource: in Claude Code, type `@` to mention one and bring a sibling thread's summary into the conversation.

---

## Available Prompts

| Prompt | Description |
|--------|-------------|
| `tm-help` | Show all available ThreadMind commands |
| `tm-context` | Load the active thread's context into the conversation |
| `tm-tree` | Show the thread tree |
| `tm-stats` | Show token savings statistics |
| `tm-create` | Create a new thread (via `thread_create`) |
| `tm-switch` | Switch to a thread (via `thread_switch`) |
| `tm-rebase` | Move a thread to a different parent (via `thread_rebase`) |
| `tm-summary` | Save the given summary, or have the AI write one (via `summary_update`) |
| `tm-init` | Generate instruction files (via `threadmind_init`) |
| `start-thread` | Same as `tm-context`, kept for compatibility |
| `summarize-thread` | Same as `tm-summary` without content, kept for compatibility |

`tm-context`, `tm-tree` and `tm-stats` embed their result directly, without a tool call. The other prompts ask the AI to call the matching tool, so your client's confirmation settings still apply to changes. Thread ID arguments support autocompletion.

In Claude Code, these appear as slash commands: `/mcp__thread-mind__tm-help`, `/mcp__thread-mind__tm-create`, etc.

### Quick Shortcuts

The server instructions teach the AI short text commands you can type directly in chat:

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
| `tm:rebase <id> <newParentId>` | Move a thread to a different parent |
| `tm:init` | Generate instruction files |
| `tm:project <title>` | Create a new project |
| `tm:projects` | List all projects |

---

## Usage Examples

### 1. Start a new project

```
You: Create a new ThreadMind project called "E-Commerce App" with system context
     "Building a Next.js e-commerce platform with Stripe payments"

AI: [calls project_create] → Project "e-commerce-app" created. Main thread active.
```

Claude Code needs no further setup. To let other agents (Codex, Cursor, Copilot…) use the project too, ask for `threadmind_init`, which generates an `AGENTS.md` file.

### 2. Work and summarize

```
You: [discuss authentication implementation with AI...]
You: Update the summary for this thread with what we discussed

AI: [calls summary_update with content summarizing the auth discussion]
```

### 3. Branch into a sub-topic

```
You: Create a new thread for "Payment Integration"

AI: [calls thread_create] → Thread "payment-integration" created under "main".

     main ← active
     └── payment-integration
```

### 4. Navigate threads

```
You: Show me the thread tree

AI: [calls thread_list] →
     main
     ├── auth-system
     │   ├── auth-ui
     │   └── auth-api
     └── payment-integration ← active
```

### 5. Get assembled context

```
You: What's the current context?

AI: [calls context_get] →
     ## System Context
     Building a Next.js e-commerce platform with Stripe payments

     ---

     ## Thread: E-Commerce App
     Project overview...

     ---

     ## Thread: Payment Integration (active)
     Stripe integration details...
```

---

## Team Mode

Team mode enables collaborative thread trees shared via git.

### How it works

1. Create a project in team mode:
   ```
   project_create with title "Shared Project" and mode "team"
   ```

2. Each team member gets an author ID on their first write, derived from `git config user.name` and a short hash of `git config user.email` (stable across clones; override it with the `THREADMIND_AUTHOR` environment variable)

3. Thread files (`.threadmind/threads/`) and tree structure (`.threadmind/trees/`) are **tracked by git**

4. The local config (`.threadmind/config.json`) is **gitignored** — each member has their own active thread state

### Rules

| Action | Own threads | Teammates' threads |
|--------|------------|-------------------|
| Read summary | Yes | Yes |
| Update summary | Yes | No |
| Delete | Yes | No |
| Create child thread | Yes | Yes |
| Switch to | Yes | Yes |

### Workflow

```bash
# Pull teammates' threads
git pull

# View the full tree (includes everyone's threads)
# → Use thread_list

# Branch from a teammate's thread
# → Use thread_create with parentId set to their thread

# Push your new threads
git add .threadmind/
git commit -m "Add payment-integration thread"
git push
```

---

## Development

### Setup

```bash
git clone <repository-url>
cd thread-mind-mcp
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
```

### Local development

```bash
npm run dev           # Watches src/ and restarts on changes
```

### Type checking

```bash
npm run lint          # TypeScript type check without emitting
```

---

## Publishing

### Prerequisites

1. Make sure you are logged in to npm:
   ```bash
   npm login
   ```

2. Ensure all tests pass:
   ```bash
   npm test
   ```

### Release

```bash
# Patch release (0.1.0 → 0.1.1) — bug fixes
npm run release:patch

# Minor release (0.1.0 → 0.2.0) — new features
npm run release:minor

# Major release (0.1.0 → 1.0.0) — breaking changes
npm run release:major
```

These commands will:
1. Run tests
2. Build the project
3. Bump the version in `package.json`
4. Publish to npm

> Don't forget to update `CHANGELOG.md` before releasing.

---

## Architecture

```
src/
  index.ts              # Entry point — stdio transport
  server.ts             # McpServer factory (tools + resources + prompts)
  types/
    index.ts            # All TypeScript interfaces
  core/
    frontmatter.ts      # YAML frontmatter parser/serializer (zero deps)
    ids.ts              # ID validation, slugification, title normalization
    lock.ts             # Cross-process lock file
    storage.ts          # File I/O layer with atomic writes
    workspace.ts        # Workspace root resolution (env, client roots, cwd)
    project.ts          # Project lifecycle management
    thread.ts           # Thread CRUD, tree operations, ASCII rendering
    context.ts          # Context assembly + token estimation
    instructions.ts     # Multi-client instruction file generator
    stats.ts            # Token savings tracking and statistics
  tools/
    index.ts            # 11 MCP tool registrations with Zod schemas
  resources/
    index.ts            # 2 MCP resource registrations
  prompts/
    index.ts            # 2 MCP prompt templates
```

### Design Decisions

- **File-based storage over SQLite** — git-friendly, human-readable, zero native dependencies
- **YAML frontmatter** — thread metadata and content in a single `.md` file, readable by both humans and tools
- **No external YAML parser** — minimal hand-rolled parser for the simple flat frontmatter format
- **Atomic writes** — write to a temp file, flush it, then rename it over the target, so a crash never leaves a partial file
- **Serialized updates** — read-modify-write operations run one at a time, across sessions too, through a lock file
- **Slugified IDs** — thread IDs derived from titles (`"Auth System"` → `"auth-system"`), collision-safe with auto-suffix, restricted to `a-z`, `0-9` and `-` (which also rules out path traversal)
- **MCP Prompts** — slash commands; read-only ones embed their result instead of asking for a tool call
- **Server instructions** — the server tells clients how to use it, so no instruction file is needed; `threadmind_init` writes the same text to AGENTS.md and other files for agents that don't read them
- **Workspace resolution** — `THREADMIND_ROOT`, then the client's roots, then the working directory
- **Token estimation** — approximate token count reported with every context assembly

---

## Requirements

- **Node.js** >= 18.0.0
- **Git** (optional, for team mode author detection and collaboration)

## License

[MIT](LICENSE)
