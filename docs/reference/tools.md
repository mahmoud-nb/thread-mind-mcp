# Tools Reference

ThreadMind exposes 12 MCP tools. All tools return structured text responses and use `isError: true` on failure.

## Project Tools

### `project_create`

Create a new ThreadMind project with a root `main` thread.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | Yes | Project title (used to generate slug ID) |
| `systemContext` | `string` | No | Global system prompt included in every context assembly |
| `mode` | `"solo"` \| `"team"` | No | Collaboration mode (default: `"solo"`) |

**Returns:** Confirmation with project ID and mode.

**Side effects:**
- Creates project config file
- Creates `main` thread
- Initializes thread tree
- Generates author ID (if first project)
- Sets as active project

---

### `project_list`

List all ThreadMind projects.

**Parameters:** None

**Returns:** Formatted list with project title, ID, mode, and active marker.

**Example output:**
```
- My App (my-app) [solo] ← active
- Side Project (side-project) [team]
```

---

### `project_switch`

Switch to a different project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | `string` | Yes | Project ID to switch to |

**Returns:** Confirmation message.

**Side effects:**
- Updates active project
- Resets active thread to `main`

---

## Thread Tools

### `thread_create`

Create a new child thread branching from a parent.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | Yes | Thread title (used to generate slug ID) |
| `parentId` | `string` | No | Parent thread ID (defaults to active thread) |

**Returns:** Confirmation with thread ID + updated tree visualization.

**Side effects:**
- Creates thread file
- Updates tree structure
- Sets new thread as active

**Parent summary check:** After creating the thread, the tool reads the parent's content. If the parent has no summary yet, a `⚠️` warning is appended to the response suggesting to run `tm:summary` on the parent before continuing. The child thread is always created regardless.

---

### `thread_switch`

Switch to a different thread.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `threadId` | `string` | Yes | Thread ID to switch to |

**Returns:** Confirmation + context preview (first 300 characters).

**Side effects:**
- Sets the thread as active

---

### `thread_list`

Display the thread tree for the active project.

**Parameters:** None

**Returns:** ASCII tree visualization with active thread marked.

**Example output:**
```
main
├── auth
│   ├── auth-ui ← active
│   └── auth-api
└── dashboard
```

---

### `thread_delete`

Delete a thread and all its descendants.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `threadId` | `string` | Yes | Thread ID to delete |

**Returns:** Confirmation + updated tree visualization.

**Constraints:**
- Cannot delete the `main` thread
- In team mode, can only delete threads you authored
- Cascades to all descendants

**Side effects:**
- Deletes thread file(s)
- Updates tree structure
- Resets active thread to `main` if the active thread was deleted

---

### `thread_rebase`

Move a thread (and all its descendants) to a different parent. Similar to `git rebase`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `threadId` | `string` | Yes | ID of the thread to move |
| `newParentId` | `string` | Yes | ID of the new parent thread |

**Returns:** Confirmation + updated tree visualization.

**Constraints:**
- Cannot rebase the `main` thread
- Cannot create circular references (target parent must not be a descendant of the thread being moved)
- Cannot rebase onto itself or the current parent
- In team mode, only the thread's author can rebase it

**Side effects:**
- Removes thread from old parent's children list
- Adds thread to new parent's children list
- Updates `parentId` in tree structure and thread frontmatter
- Updates `updatedAt` timestamp on the moved thread

---

## Summary & Context Tools

### `summary_update`

Update the summary content of a thread.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `content` | `string` | Yes | New summary content (markdown) |
| `threadId` | `string` | No | Thread to update (defaults to active thread) |

**Returns:** Confirmation with thread ID.

**Constraints:**
- In team mode, can only update threads you authored

**Side effects:**
- Overwrites the thread's content with the new summary
- Updates `updatedAt` timestamp
- Records update in token savings statistics

---

### `context_get`

Get the full assembled context for the active thread.

**Parameters:** None

**Returns:** The assembled context string — system context + ancestor summaries from root to active thread, with a token estimation footer:

```
ThreadMind context: ~450 tokens | depth: 3 threads
```

**Algorithm:**
1. Walk from active thread to root via `parentId`
2. Reverse the chain (root → active)
3. Concatenate system context + summaries
4. Skip threads with empty content
5. Estimate token count (~1 token per 3.5 characters)

See [Context Assembly](/guide/context-assembly) for details.

---

## Setup Tools

### `threadmind_init`

Generate instruction files for AI clients to enable semi-automatic ThreadMind usage.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `clients` | `string[]` | No | Clients to generate for: `"claude"`, `"cursor"`, `"generic"` (default: all) |

**Returns:** Confirmation listing generated files.

**Generated files:**

| Client | File | Behavior |
|--------|------|----------|
| Claude Code | `CLAUDE.md` | Read automatically at every session start |
| Cursor | `.cursorrules` | Read automatically by Cursor |
| Generic | `.threadmind/instructions.md` | Copy-paste into any client's custom instructions |

The generated instructions tell the AI to:
- Call `context_get` at the start of every session
- Call `summary_update` after each significant discussion
- Use `thread_create` when the topic changes
- Use `thread_list` to visualize the current state

---

## MCP Prompts

ThreadMind provides 11 MCP Prompts — structured templates that clients can invoke as slash commands.

### Core Prompts

#### `start-thread`

Load and inject the assembled context at the start of a session.

**Arguments:** None

**Returns:** A user message containing the full assembled context with token estimation.

**Use case:** Invoke at the beginning of a new conversation to bootstrap the AI with your thread tree context.

#### `summarize-thread`

Guide the AI to generate a structured summary for the current thread.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `topic` | `string` | No | Brief description of what was discussed |

**Returns:** Instructions for the AI to summarize the current discussion and save it via `summary_update`.

### Quick-Action Prompts

These prompts act as shortcuts — each one triggers the corresponding tool immediately.

| Prompt | Shortcut for | Arguments |
|--------|-------------|-----------|
| `tm-help` | — | None |
| `tm-context` | `context_get` | None |
| `tm-tree` | `thread_list` | None |
| `tm-create` | `thread_create` | `title` (required) |
| `tm-switch` | `thread_switch` | `threadId` (required) |
| `tm-rebase` | `thread_rebase` | `threadId` (required), `newParentId` (required) |
| `tm-summary` | `summary_update` | `content` (optional — auto-generates if omitted) |
| `tm-stats` | `stats_show` | None |
| `tm-init` | `threadmind_init` | None |

In Claude Code, these appear as `/mcp__thread-mind__tm-help`, `/mcp__thread-mind__tm-create`, etc.

### Text Shortcuts (`tm:` commands)

After running `threadmind_init`, the generated `CLAUDE.md` teaches the AI to recognize short text commands typed directly in chat:

```
tm:help                → Show all commands
tm:context             → context_get
tm:tree                → thread_list
tm:create Auth System  → thread_create(title: "Auth System")
tm:switch auth-ui      → thread_switch(threadId: "auth-ui")
tm:rebase auth-ui dashboard → thread_rebase(threadId: "auth-ui", newParentId: "dashboard")
tm:summary             → Auto-generate + save summary
tm:summary <content>   → summary_update(content: ...)
tm:stats               → stats_show
tm:delete auth-api     → thread_delete(threadId: "auth-api")
tm:init                → threadmind_init
tm:project My App      → project_create(title: "My App")
tm:projects            → project_list
```

These work in any AI client that reads `CLAUDE.md` or `.cursorrules`.

---

## Statistics Tools

### `stats_show`

Show token savings statistics for the active ThreadMind project.

**Parameters:** None

**Returns:** A formatted report showing:
- Overview: thread count, summary updates, current context size
- Token savings: estimated raw history vs ThreadMind context, compression ratio
- Per-thread breakdown: updates, current tokens, cumulative input, ratio

**Example output:**
```
ThreadMind Stats: "My Project"

Overview:
  Threads: 5 (3 with tracked updates)
  Summary updates: 12
  Current context: ~450 tokens (depth: 3)

Token Savings (estimated):
  Estimated raw history: ~12,000 tokens
  ThreadMind context:    ~450 tokens
  Reduction:             ~96%

Per-Thread Breakdown:
  Thread               Updates  Current   Cumulative    Ratio
  main                 4        ~120      ~3400         96%
  auth-system          3        ~90       ~2800         97%

Method: Cumulative summary input vs current context size.
Token estimates use ~3.5 chars/token approximation.
```

**How it works:** Every call to `summary_update` is tracked. The cumulative input represents the total text compressed into summaries over time. The ratio compares this cumulative input against the current assembled context — showing how much information ThreadMind compresses.

::: info
Token estimates are approximations (~3.5 chars/token). The MCP protocol does not provide access to actual model token consumption. All metrics are derived from text ThreadMind stores and serves.
:::

---

## Error Handling

All tools follow the same error pattern:

```json
{
  "content": [{ "type": "text", "text": "Error: No active project. Use project_create first." }],
  "isError": true
}
```

Common errors:
- `"No active project. Use project_create first."` — no project selected
- `"Thread \"x\" not found"` — invalid thread ID
- `"Parent thread \"x\" not found"` — invalid parent for thread creation
- `"Cannot delete the main thread"` — attempted to delete root
- `"Cannot rebase the main thread"` — attempted to rebase root
- `"\"x\" is a descendant of \"y\""` — circular reference detected during rebase
- `"Cannot update thread \"x\": owned by \"y\""` — ownership violation in team mode
