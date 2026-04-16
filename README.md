# ThreadMind MCP

**Organize your AI conversations into thread trees. Think less tokens, think more.**

ThreadMind is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that structures AI conversations into hierarchical threads. Instead of feeding entire conversation histories to your AI model, ThreadMind lets you maintain concise summaries organized in a tree — drastically reducing token consumption while preserving full context.

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

### Configure with other MCP clients

ThreadMind uses the **stdio transport**, compatible with any MCP client:

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
| `thread_switch` | Switch to a different thread |
| `thread_list` | Display the thread tree as ASCII art |
| `thread_delete` | Delete a thread and all its descendants |

#### `thread_create`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Thread title (used to generate ID) |
| `parentId` | string | No | Parent thread ID (defaults to active thread) |

#### `thread_delete`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `threadId` | string | Yes | Thread ID to delete (cascades to descendants) |

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
| `threadmind_init` | Generate instruction files for AI clients (CLAUDE.md, .cursorrules, etc.) |

#### `threadmind_init`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clients` | string[] | No | Clients to generate for: `"claude"`, `"cursor"`, `"generic"` (default: all) |

Generates instruction files that tell AI clients to automatically use ThreadMind:

| Client | File | Behavior |
|--------|------|----------|
| Claude Code | `CLAUDE.md` | Read automatically at every session start |
| Cursor | `.cursorrules` | Read automatically by Cursor |
| Generic | `.threadmind/instructions.md` | Copy-paste into any client's custom instructions |

---

## Available Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Current Context | `threadmind://context` | Assembled context for the active thread |
| Thread Tree | `threadmind://tree` | ASCII visualization of the thread tree |

---

## Available Prompts

| Prompt | Description |
|--------|-------------|
| `start-thread` | Load and inject the assembled context at the start of a session |
| `summarize-thread` | Guide the AI to generate a structured summary for the current thread |

---

## Usage Examples

### 1. Start a new project

```
You: Create a new ThreadMind project called "E-Commerce App" with system context
     "Building a Next.js e-commerce platform with Stripe payments"

AI: [calls project_create] → Project "e-commerce-app" created. Main thread active.

You: Initialize ThreadMind for this project

AI: [calls threadmind_init] → Generated CLAUDE.md, .cursorrules, instructions.md
```

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

2. Each team member gets a unique author ID (auto-generated from `git config user.name`)

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
    storage.ts          # File I/O layer with atomic writes
    project.ts          # Project lifecycle management
    thread.ts           # Thread CRUD, tree operations, ASCII rendering
    context.ts          # Context assembly + token estimation
    instructions.ts     # Multi-client instruction file generator
  tools/
    index.ts            # 10 MCP tool registrations with Zod schemas
  resources/
    index.ts            # 2 MCP resource registrations
  prompts/
    index.ts            # 2 MCP prompt templates
```

### Design Decisions

- **File-based storage over SQLite** — git-friendly, human-readable, zero native dependencies
- **YAML frontmatter** — thread metadata and content in a single `.md` file, readable by both humans and tools
- **No external YAML parser** — minimal hand-rolled parser for the simple flat frontmatter format
- **Atomic writes** — write to temp file first, prevents corruption on crash
- **Slugified IDs** — thread IDs derived from titles (`"Auth System"` → `"auth-system"`), collision-safe with auto-suffix
- **MCP Prompts** — structured templates (`start-thread`, `summarize-thread`) to guide AI clients
- **Multi-client instructions** — auto-generated CLAUDE.md / .cursorrules for seamless integration
- **Token estimation** — approximate token count reported with every context assembly

---

## Requirements

- **Node.js** >= 18.0.0
- **Git** (optional, for team mode author detection and collaboration)

## License

[MIT](LICENSE)
