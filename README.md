# ThreadMind MCP

[![npm version](https://img.shields.io/npm/v/thread-mind-mcp.svg)](https://www.npmjs.com/package/thread-mind-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Branches for your AI's memory: a git-friendly tree of thread summaries.**

ThreadMind is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives AI coding sessions a memory: a tree of threads, each holding a short summary of what was decided about one topic, stored as Markdown in your repository. Start a fresh session and the active thread's context — its decisions and those of its ancestors — replaces a history that had grown to tens of thousands of tokens.

> **[Documentation](https://mahmoud-nb.github.io/thread-mind-mcp/)** | **[npm](https://www.npmjs.com/package/thread-mind-mcp)** | **[GitHub](https://github.com/mahmoud-nb/thread-mind-mcp)**

---

## Why ThreadMind?

With AI coding assistants, conversations grow long: every request carries the whole history, until the client compacts it or you start over — and starting over loses what was decided. ThreadMind keeps what matters:

- **Summaries in sections** — Decisions, Constraints, State, Open questions, Next steps
- **Inheritance through the tree** — a thread's context is its summary plus its ancestors' decisions and constraints; sibling branches stay out
- **Branching exploration** — try approaches in separate threads, merge the winner's conclusions into the parent, keep the reason an approach was abandoned
- **Git-aware** — a thread created on a feature branch becomes active whenever that branch is checked out, and summaries warn when the code they describe has changed
- **Team collaboration** — thread files are committed with the code and reviewed in pull requests

### Where the savings come from

ThreadMind can't shrink a conversation in progress: your client decides what it sends. The savings come when you start over:

```
Before /clear:   the conversation carries ~48,000 tokens of history
After /clear:    the session starts with the thread's context, ~1,100 tokens

main
├── auth
│   └── auth-ui ← active     context = main + auth (decisions, constraints) + auth-ui
└── dashboard                 dashboard stays out
```

With the [Claude Code plugin](#claude-code-plugin-recommended), the context reloads automatically after `/clear` and after compaction, and `stats_show` measures both sizes on your own sessions.

---

## Quick Start

### Claude Code plugin (recommended)

```
/plugin marketplace add mahmoud-nb/thread-mind-mcp
/plugin install thread-mind@thread-mind
```

The plugin installs the server and adds:

- a **SessionStart hook** that loads the active thread's context at startup, after `/clear` and after compaction (nothing happens in repositories without a ThreadMind project)
- a **SessionEnd hook** that records how large the conversation grew, read from its transcript, for `stats_show`
- **commands**: `/thread-mind:context`, `/thread-mind:tree`, `/thread-mind:create`, `/thread-mind:switch`, `/thread-mind:summary`, `/thread-mind:merge`, `/thread-mind:stats`

If you configured ThreadMind manually before, remove that configuration so Claude Code doesn't run two servers.

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
| **Thread** | A node in the tree representing a discussion topic. Stores a markdown summary, and may be linked to a git branch, done or abandoned. |
| **Summary** | What was decided in a thread, in sections: Decisions, Constraints, State, Open questions, Next steps. |
| **Context** | The active thread's summary plus its ancestors' decisions and constraints — what the AI loads. |
| **Session** | Each client session has its own active thread; new sessions start from the checked-out git branch. |

### Storage

ThreadMind stores everything in a `.threadmind/` directory at your project root:

```
.threadmind/
  config.json              # Local state: where sessions start, author ID, session measurements
  .gitignore               # Excludes config.json from git
  projects/
    my-app.json            # Project configuration
  threads/
    my-app/
      main.md              # Root thread (markdown + YAML frontmatter)
      auth-system.md       # Child thread
      auth-api.md          # Grandchild thread
```

Thread files use YAML frontmatter. Each one records its parent: the tree is rebuilt from the files, with no index to keep in sync or to conflict in git.

```markdown
---
id: auth-system
title: Authentication System
parentId: main
author: mahmoud-a3f9
createdAt: 2026-04-15T10:00:00.000Z
updatedAt: 2026-04-15T12:30:00.000Z
branch: feature/auth
commit: 3f2a9c1e5b7d4a8f0c6e2b1d9a7f5c3e1b0d8a6f
paths: ["src/auth"]
---

## Decisions
- JWT with refresh tokens, stored in httpOnly cookies
- Passport.js over custom middleware, for maintainability

## State
- Login and refresh done, logout pending
```

`status`, `branch`, `commit`, `paths` and `mergedInto` only appear when set.

### Context Assembly

When you request context, ThreadMind walks up from the active thread to the root. It keeps the whole summary of the active thread, and only the **Decisions** and **Constraints** of its ancestors:

```
## System Context
You are building a Next.js e-commerce application...

---

## Thread: My App

## Decisions
- Next.js 15, PostgreSQL, Stripe

---

## Thread: Authentication System

## Decisions
- JWT with refresh tokens, bcrypt, Passport.js

---

## Thread: Auth API Endpoints (active)

_⚠ 2 commits changed src/api since this summary was written: check it is still accurate._

## Decisions
- POST /auth/login, POST /auth/register, POST /auth/refresh

## Next steps
- Rate limiting on /auth/login

---
_ThreadMind context: ~160 tokens | depth: 3 threads_
```

- Only the **direct ancestor chain** is included — sibling branches are excluded
- Summaries written before code changes are flagged, using the commit and `paths` recorded with them
- `maxTokens` leaves out the farthest ancestors first when the context would be too large

---

## Available Tools

Each tool declares a title and MCP annotations (read-only, destructive, idempotent), which clients can use to decide when to ask for confirmation.

### Project Management

| Tool | Description |
|------|-------------|
| `project_create` | Create a new project with a root "main" thread |
| `project_list` | List all projects (shows the session's project) |
| `project_switch` | Switch the session to a different project (a single project is selected automatically) |

#### `project_create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Project title (used to generate ID) |
| `systemContext` | string | No | System prompt or global instructions |
| `mode` | `"solo"` \| `"team"` | No | Project mode (default: `"solo"`) |

### Thread Management

| Tool | Description |
|------|-------------|
| `thread_create` | Create a child thread; on a feature branch, link it to the branch |
| `thread_switch` | Switch this session to a different thread and return its assembled context |
| `thread_list` | Display the thread tree, with statuses and linked branches |
| `thread_status` | Mark a thread done or abandoned (the reason is kept in its decisions), or reopen it |
| `thread_merge` | Fold a finished thread into its parent: replaces the parent's summary, marks the thread done |
| `thread_delete` | Delete a thread and all its descendants |
| `thread_rebase` | Move a thread to a different parent (like `git rebase`) |

#### `thread_create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Thread title (used to generate ID) |
| `parentId` | string | No | Parent thread ID (defaults to active thread) |

#### `thread_status`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | `"active"` \| `"done"` \| `"abandoned"` | Yes | New status |
| `threadId` | string | No | Target thread (defaults to active thread) |
| `reason` | string | No | Why, added to the thread's Decisions section |

#### `thread_merge`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `parentSummary` | string | Yes | The parent's new summary, including the thread's conclusions |
| `threadId` | string | No | Thread to merge (defaults to active thread) |

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
| `summary_update` | Update the summary of a thread, or one of its sections |
| `context_get` | Get the assembled context with token estimation |

#### `summary_update`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | New summary, or the text to add to `section` (markdown) |
| `threadId` | string | No | Target thread (defaults to active thread) |
| `section` | string | No | `decisions`, `constraints`, `state`, `open-questions` or `next-steps`: only update that section |
| `replaceSection` | boolean | No | Replace the section instead of adding to it |
| `paths` | string[] | No | Files or directories the thread is about, to flag the summary when they change |

#### `context_get`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `maxTokens` | number | No | Token budget; the farthest ancestors are left out first (`thread_switch` accepts it too) |

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
| `stats_show` | Show summary sizes and, with the Claude Code plugin, measured conversation sizes |

With the plugin, each session records the size its conversation reached (read from the Claude Code transcript) and the context loaded when the next one started. `stats_show` reports both:

```
Measured sessions (Claude Code plugin):
  Conversation size when sessions ended: ~48,200 tokens on average, ~96,000 at most (12 sessions)
  ThreadMind context loaded at session start: ~1,150 tokens on average (14 sessions)
```

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
| `tm-stats` | Show statistics |
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
| `tm:summary` | Write and save the summary |
| `tm:summary <content>` | Save specific summary content |
| `tm:merge` | Fold the thread into its parent |
| `tm:done [reason]` | Mark the thread done |
| `tm:abandon <reason>` | Mark the thread abandoned |
| `tm:stats` | Show statistics |
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
You: [discuss the architecture with AI...]
You: tm:summary

AI: [writes the summary in sections, then calls summary_update]
     ## Decisions
     - Next.js 15 App Router, PostgreSQL with Prisma, Stripe Checkout
     ## Next steps
     - Authentication

You: We'll use Stripe webhooks for order confirmation, record it.

AI: [calls summary_update with section "decisions"] → Section "decisions" updated.
```

### 3. Branch into a sub-topic, on its git branch

```
$ git switch -c feature/payments

You: tm:create Payment Integration

AI: [calls thread_create] → Thread "payment-integration" created under "main".
     Linked to git branch "feature/payments".

     main
     └── payment-integration [branch: feature/payments] ← active
```

### 4. Start fresh when the conversation grows

```
You: tm:summary
You: /clear

(the plugin loads the context of payment-integration: main's decisions
 and constraints, then the whole payment-integration summary)
```

Without the plugin, ask for `tm:context` in the new session.

### 5. Finish the thread

```
You: tm:merge

AI: [writes main's new summary with the payment decisions, calls thread_merge]
     → Thread "payment-integration" merged into "main", which is now the active thread.

     main ← active
     └── payment-integration [done] [branch: feature/payments]
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

3. Thread files (`.threadmind/threads/`) are **tracked by git**. Each one records its parent, so two people creating threads never conflict, even under the same parent

4. The local config (`.threadmind/config.json`) is **gitignored** — each member has their own session state and measurements

5. A teammate who checks out your feature branch starts on the thread linked to it

### Rules

| Action | Own threads | Teammates' threads |
|--------|------------|-------------------|
| Read summary | Yes | Yes |
| Update summary, change status | Yes | No |
| Merge into parent | If you own the parent too | No |
| Delete | Yes, unless a descendant is a teammate's | No |
| Create child thread | Yes | Yes |
| Switch to | Yes | Yes |

Ownership prevents accidental edits; it is not access control.

> **Upgrading from 0.4:** the tree used to live in `.threadmind/trees/`. ThreadMind now moves it into the thread files on first use and deletes `trees/<project>.json` — commit that change, and upgrade the whole team together. `.threadmind/stats/` is no longer used and can be deleted.

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

### Hooks

The Claude Code hooks are subcommands of the same binary; they read the hook input on stdin:

```bash
echo '{"session_id":"test","cwd":"'$PWD'","source":"startup"}' | node dist/index.js hook session-start
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

The changelog is generated from the commits since the last version tag: make sure the previous release is tagged (`git tag`).

```bash
# Patch release (0.1.0 → 0.1.1) — bug fixes
npm run release:patch

# Minor release (0.1.0 → 0.2.0) — new features
npm run release:minor

# Major release (0.1.0 → 1.0.0) — breaking changes
npm run release:major
```

These commands will:
1. Bump the version in `package.json`, update `CHANGELOG.md` from the commits, commit and tag
2. Run the tests and build the project
3. Publish to npm
4. Run `npm run plugin:sync`: point the Claude Code plugin and `server.json` at the new version, regenerate the plugin's lockfile (Claude Code installs the server from it) and commit

Then push with the tags:

```bash
git push origin master --follow-tags
```

If `plugin:sync` fails because npm doesn't serve the new version yet, run it again a minute later.

### MCP Registry

`server.json` describes the server for the [MCP Registry](https://registry.modelcontextprotocol.io). After a release:

```bash
mcp-publisher login github
mcp-publisher publish
```

---

## Architecture

```
src/
  index.ts              # Entry point — stdio server, or `hook <event>` for the Claude Code hooks
  server.ts             # McpServer factory (tools + resources + prompts + instructions)
  services.ts           # Services over one .threadmind directory, shared by server and hooks
  types/
    index.ts            # All TypeScript interfaces
  core/
    frontmatter.ts      # YAML frontmatter parser/serializer (zero deps)
    ids.ts              # ID validation, slugification, title normalization
    lock.ts             # Cross-process lock file
    clock.ts            # Strictly increasing timestamps
    storage.ts          # File I/O with atomic writes; tree derived from thread files
    workspace.ts        # Workspace root resolution (env, client roots, cwd)
    session.ts          # Active thread per session, per git branch
    git.ts              # Current branch, commits since a summary
    summary.ts          # Summary sections: inheritance, section updates
    project.ts          # Project lifecycle management
    thread.ts           # Thread CRUD, status, merge, tree rendering
    context.ts          # Context assembly, outdated summary notes, token budget
    instructions.ts     # Server instructions and instruction files
    stats.ts            # Session measurements and statistics report
  hooks/
    index.ts            # SessionStart / SessionEnd hooks of the Claude Code plugin
  tools/
    index.ts            # 14 MCP tools with Zod schemas and annotations
  resources/
    index.ts            # 2 MCP resources + the thread resource template
  prompts/
    index.ts            # 11 MCP prompts
plugin/                 # Claude Code plugin (manifest, .mcp.json, hooks, commands)
.claude-plugin/         # Marketplace listing the plugin
server.json             # MCP Registry metadata
```

### Design Decisions

- **File-based storage over SQLite** — git-friendly, human-readable, zero native dependencies
- **Thread files as the single source of truth** — each file records its parent; no tree index to drift or to conflict in git
- **YAML frontmatter** — thread metadata and content in a single `.md` file, readable by both humans and tools
- **No external YAML parser** — minimal hand-rolled parser for the simple flat frontmatter format
- **Atomic writes** — write to a temp file, flush it, then rename it over the target, so a crash never leaves a partial file
- **Serialized updates** — read-modify-write operations run one at a time, across sessions and hooks too, through a lock file
- **Slugified IDs** — thread IDs derived from titles (`"Auth System"` → `"auth-system"`), collision-safe with auto-suffix, restricted to `a-z`, `0-9` and `-` (which also rules out path traversal)
- **One active thread per session** — sessions don't move each other; new sessions start from the checked-out git branch
- **Selective inheritance** — ancestors pass on their decisions and constraints, not their state or next steps
- **MCP Prompts** — slash commands; read-only ones embed their result instead of asking for a tool call
- **Server instructions** — the server tells clients how to use it, so no instruction file is needed; `threadmind_init` writes the same text to AGENTS.md and other files for agents that don't read them
- **Workspace resolution** — `THREADMIND_ROOT`, then the client's roots, then the working directory
- **Measured, not estimated, savings** — conversation sizes come from the Claude Code transcripts; context sizes are estimates (~3.5 characters per token)

---

## Requirements

- **Node.js** >= 18.0.0
- **Git** (optional: team mode author detection, thread–branch links, outdated summary warnings)

## License

[MIT](LICENSE)
