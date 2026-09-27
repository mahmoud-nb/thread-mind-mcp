# Tools Reference

ThreadMind exposes 12 MCP tools. All tools return structured text responses and use `isError: true` on failure.

Each tool declares a title and MCP annotations: `readOnlyHint` for `project_list`, `thread_list`, `context_get` and `stats_show`; `destructiveHint` for `thread_delete` and `summary_update` (which replaces the previous summary). Clients can use them to decide when to ask for confirmation.

The server also sends usage instructions to the client when it connects (MCP server instructions), so clients such as Claude Code need no instruction file.

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
- Generates your author ID (if not set yet)
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

**Returns:** Confirmation + the full assembled context of the new thread, so no `context_get` call is needed afterwards.

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

Write the server's usage instructions into files read by agents that don't receive MCP server instructions. Claude Code doesn't need any.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `clients` | `string[]` | No | Files to generate: `"agents"`, `"claude"`, `"cursor"`, `"generic"` (default: `agents` and `generic`) |

**Returns:** Confirmation listing generated files, plus notes about sections left by earlier versions.

**Generated files:**

| Target | File | Read by |
|--------|------|---------|
| `agents` | `AGENTS.md` | Codex, Cursor, GitHub Copilot and other agents |
| `claude` | `CLAUDE.md` | Claude Code — not needed, it receives the server instructions |
| `cursor` | `.cursor/rules/threadmind.mdc` | Cursor, as an always-applied project rule |
| `generic` | `.threadmind/instructions.md` | Paste into any client's custom instructions |

In Markdown files, the ThreadMind section sits between `<!-- threadmind:start -->` and `<!-- threadmind:end -->` markers, so the rest of the file is preserved. The Cursor rule file is entirely generated.

The instructions tell the AI to:
- Call `context_get` once at the start of a session
- Call `summary_update` after a decision or a completed task, keeping what is still true
- Use `thread_list`, then `thread_switch` or `thread_create`, when the topic changes
- Run the `tm:` shortcuts typed by the user

**Migration:** earlier versions wrote `CLAUDE.md` and `.cursorrules`. When it generates the Cursor rule, `threadmind_init` moves the ThreadMind section out of `.cursorrules` (and deletes the file if nothing else remains). A ThreadMind section left in a file you didn't target is reported, not modified.

---

## MCP Prompts

ThreadMind provides 11 MCP Prompts — structured templates that clients can invoke as slash commands.

### Read-only prompts

These prompts embed their result directly in the message, without a tool call.

| Prompt | Content | Arguments |
|--------|---------|-----------|
| `tm-help` | Command reference and active project/thread | None |
| `tm-context` | Assembled context of the active thread | None |
| `tm-tree` | Thread tree of the active project | None |
| `tm-stats` | Token savings statistics | None |

### Prompts that change state

These prompts ask the AI to call the matching tool, so the client's confirmation settings still apply.

| Prompt | Tool | Arguments |
|--------|------|-----------|
| `tm-create` | `thread_create` | `title` (required) |
| `tm-switch` | `thread_switch` | `threadId` (required, autocompleted) |
| `tm-rebase` | `thread_rebase` | `threadId`, `newParentId` (required, autocompleted) |
| `tm-summary` | `summary_update` | `content` (optional — the AI writes the summary if omitted), `topic` (optional hint) |
| `tm-init` | `threadmind_init` | None |

Without `content`, `tm-summary` gives the AI the current summary and a template (decisions and rationale, technical choices, current state, open questions).

### Compatibility aliases

| Prompt | Same as |
|--------|---------|
| `start-thread` | `tm-context` |
| `summarize-thread` | `tm-summary` without `content` (takes an optional `topic`) |

In Claude Code, these appear as `/mcp__thread-mind__tm-help`, `/mcp__thread-mind__tm-create`, etc.

### Text Shortcuts (`tm:` commands)

The server instructions (and the files generated by `threadmind_init`) teach the AI to recognize short text commands typed directly in chat:

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

These work in any AI client that reads the MCP server instructions or one of the generated files.

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

Thread and project IDs only accept lowercase letters, digits and hyphens. Any other value (including paths such as `../`) is rejected before the tool runs, with an `Input validation error`.

Common errors:
- `"No active project. Use project_create first."` — no project selected
- `"Thread \"x\" not found"` — the thread is not in the active project's tree
- `"Parent thread \"x\" not found"` — invalid parent for thread creation
- `"Cannot delete the main thread"` — attempted to delete root
- `"Cannot rebase the main thread"` — attempted to rebase root
- `"\"x\" is a descendant of \"y\""` — circular reference detected during rebase
- `"Cannot update thread \"x\": owned by \"y\""` — ownership violation in team mode
- `"... its descendants include threads owned by others"` — team mode deletion that would cascade to a teammate's threads
