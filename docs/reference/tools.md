# Tools Reference

ThreadMind exposes 14 MCP tools. All tools return structured text responses and use `isError: true` on failure. Started by the Claude Code plugin, the server also exposes [`threadmind_hook`](#threadmind-hook), which only the plugin's hooks call.

Each tool declares a title and MCP annotations: `readOnlyHint` for `project_list`, `thread_list`, `context_get` and `stats_show`; `destructiveHint` for `thread_delete`, `summary_update` (which can replace the previous summary) and `thread_merge` (which replaces the parent's summary). Clients can use them to decide when to ask for confirmation.

The server also sends usage instructions to the client when it connects (MCP server instructions), so clients such as Claude Code need no instruction file.

Each session has its own active project and thread: see [The Active Thread](/guide/threads#the-active-thread).

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
- Creates project config file and `main` thread
- Generates your author ID (if not set yet)
- Makes it the session's active project, on `main`

---

### `project_list`

List all ThreadMind projects.

**Parameters:** None

**Returns:** Formatted list with project title, ID, mode, and the session's project marked.

**Example output:**
```
- My App (my-app) [solo] ← active
- Side Project (side-project) [team]
```

---

### `project_switch`

Switch the session to a different project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | `string` | Yes | Project ID to switch to |

**Returns:** Confirmation with the active thread, chosen as when a session starts.

A repository with a single project doesn't need it: that project is selected automatically.

---

## Thread Tools

### `thread_create`

Create a new child thread branching from a parent.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | Yes | Thread title (used to generate slug ID) |
| `parentId` | `string` | No | Parent thread ID (defaults to active thread) |

**Returns:** Confirmation with thread ID, the branch it was linked to (if any), and the updated tree.

**Side effects:**
- Creates the thread file
- On a feature branch without an open linked thread, links the thread to that branch
- Makes it the session's active thread

**Parent summary check:** if the parent has no summary yet, a `⚠️` warning suggests running `tm:summary` on it. The thread is created regardless.

---

### `thread_switch`

Switch the session to a different thread.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `threadId` | `string` | Yes | Thread ID to switch to |
| `maxTokens` | `number` | No | Token budget for the returned context |

**Returns:** Confirmation + the full assembled context of the new thread, so no `context_get` call is needed afterwards.

Other sessions keep their own thread; new sessions on the same git branch start on this one.

---

### `thread_list`

Display the thread tree of the session's project.

**Parameters:** None

**Returns:** ASCII tree with the active thread, statuses and linked branches.

**Example output:**
```
main
├── auth
│   ├── auth-ui [branch: feature/auth-ui] ← active
│   └── auth-api
├── graphql [abandoned]
└── dashboard
```

---

### `thread_status`

Mark a thread as done or abandoned, or reopen it.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `status` | `"active"` \| `"done"` \| `"abandoned"` | Yes | New status |
| `threadId` | `string` | No | Thread ID (defaults to active thread) |
| `reason` | `string` | No | Why; added to the thread's Decisions section |

**Returns:** Confirmation + updated tree.

**Constraints:**
- The `main` thread can't be closed
- In team mode, only the thread's author can change its status

A closed thread is no longer linked to its branch for new sessions.

---

### `thread_merge`

Fold a finished thread into its parent.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `parentSummary` | `string` | Yes | The parent's new summary, including the thread's conclusions (the AI writes it) |
| `threadId` | `string` | No | Thread to merge (defaults to active thread) |

**Returns:** Confirmation + updated tree.

**Side effects:**
- Replaces the parent's summary with `parentSummary`
- Marks the thread `done`, with `mergedInto` set to the parent
- Makes the parent the session's active thread

In team mode, you need to own both the thread and its parent.

---

### `thread_delete`

Delete a thread and all its descendants.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `threadId` | `string` | Yes | Thread ID to delete |

**Returns:** Confirmation + updated tree.

**Constraints:**
- Cannot delete the `main` thread
- In team mode, can only delete threads you authored, and not if a descendant belongs to a teammate
- Cascades to all descendants

A session whose active thread was deleted moves on as when a session starts.

---

### `thread_rebase`

Move a thread (and all its descendants) to a different parent. Similar to `git rebase`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `threadId` | `string` | Yes | ID of the thread to move |
| `newParentId` | `string` | Yes | ID of the new parent thread |

**Returns:** Confirmation + updated tree.

**Constraints:**
- Cannot rebase the `main` thread
- Cannot create circular references (target parent must not be a descendant of the thread being moved)
- Cannot rebase onto itself or the current parent
- In team mode, only the thread's author can rebase it

**Side effects:** updates `parentId` and `updatedAt` in the thread's frontmatter; descendants follow.

---

## Summary & Context Tools

### `summary_update`

Update the summary of a thread, or one of its sections.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `content` | `string` | Yes | New summary, or the text to add to `section` (markdown) |
| `threadId` | `string` | No | Thread to update (defaults to active thread) |
| `section` | `string` | No | Only update this section: `decisions`, `constraints`, `state`, `open-questions` or `next-steps` |
| `replaceSection` | `boolean` | No | Replace the section instead of adding to it (for `state` and `next-steps`) |
| `paths` | `string[]` | No | Files or directories the thread is about; an empty list clears them. When omitted, the files Claude edited on the thread since the last save are added, if the [Claude Code plugin](/guide/claude-code-plugin#edited-files-recorded-with-the-summary) reported them |

**Returns:** Confirmation with thread ID, and the files recorded with the summary when the plugin reported them.

**Constraints:**
- In team mode, can only update threads you authored

**Side effects:**
- Without `section`, replaces the whole summary; with it, adds to (or replaces) that section only, creating it at its place if missing
- Records the current git commit, used to flag the summary once its `paths` change
- Updates `updatedAt`

---

### `context_get`

Get the assembled context of the session's active thread.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `maxTokens` | `number` | No | Token budget: the farthest ancestors are left out first |

**Returns:** The system context, the durable sections (Decisions, Constraints) of the ancestors' summaries, and the whole summary of the active thread, with a footer:

```
_ThreadMind context: ~450 tokens | depth: 3 threads_
```

**Algorithm:**
1. Walk from the active thread to the root via `parentId`
2. Reverse the chain (root → active)
3. Keep the ancestors' Decisions and Constraints (free-form summaries whole) and the active thread's whole summary; skip empty summaries
4. Add a warning under summaries whose `paths` changed since they were written
5. Leave out the farthest ancestors to fit `maxTokens`
6. Estimate token count (~1 token per 3.5 characters)

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
| `cursor` | `.cursor/rules/threadmind.mdc` | Cursor, as an always-applied project rule, instead of `AGENTS.md` (Cursor reads both) |
| `generic` | `.threadmind/instructions.md` | Paste into any client's custom instructions |

In Markdown files, the ThreadMind section sits between `<!-- threadmind:start -->` and `<!-- threadmind:end -->` markers, so the rest of the file is preserved. The Cursor rule file is entirely generated.

The instructions tell the AI to:
- Call `context_get` once at the start of a session, unless the context was already loaded
- Structure summaries in sections, and add to a section with `summary_update` after a decision or a completed task
- Use `thread_list`, then `thread_switch` or `thread_create`, when the topic changes
- Close finished threads with `thread_merge` or `thread_status`
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
| `tm-stats` | Summary sizes and measured conversation sizes | None |

### Prompts that change state

These prompts ask the AI to call the matching tool, so the client's confirmation settings still apply.

| Prompt | Tool | Arguments |
|--------|------|-----------|
| `tm-create` | `thread_create` | `title` (required) |
| `tm-switch` | `thread_switch` | `threadId` (required, autocompleted) |
| `tm-rebase` | `thread_rebase` | `threadId`, `newParentId` (required, autocompleted) |
| `tm-summary` | `summary_update` | `content` (optional — the AI writes the summary if omitted), `topic` (optional hint) |
| `tm-init` | `threadmind_init` | None |

Without `content`, `tm-summary` gives the AI the current summary and the section template.

### Compatibility aliases

| Prompt | Same as |
|--------|---------|
| `start-thread` | `tm-context` |
| `summarize-thread` | `tm-summary` without `content` (takes an optional `topic`) |

In Claude Code, these appear as `/mcp__thread-mind__tm-help`, `/mcp__thread-mind__tm-create`, etc. The [Claude Code plugin](/guide/claude-code-plugin) adds shorter `/thread-mind:*` commands.

### Text Shortcuts (`tm:` commands)

The server instructions (and the files generated by `threadmind_init`) teach the AI to recognize short text commands typed directly in chat:

```
tm:help                → Show all commands
tm:context             → context_get
tm:tree                → thread_list
tm:create Auth System  → thread_create(title: "Auth System")
tm:switch auth-ui      → thread_switch(threadId: "auth-ui")
tm:rebase auth-ui dashboard → thread_rebase(threadId: "auth-ui", newParentId: "dashboard")
tm:summary             → Write + save the summary
tm:summary <content>   → summary_update(content: ...)
tm:merge               → thread_merge (the AI writes the parent's new summary)
tm:done [reason]       → thread_status(status: "done")
tm:abandon <reason>    → thread_status(status: "abandoned")
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

Show the state of the project's summaries and, with the Claude Code plugin, how large conversations actually grew.

**Parameters:** None

**Example output:**
```
ThreadMind Stats: "My Project"

Threads: 7 (5 active, 1 done, 1 abandoned)
Active thread: auth-ui (depth 3, ~450 tokens of context)

Summaries:
  Thread                   Tokens   Updated
  main                     ~120     2026-09-20
  auth                     ~90      2026-09-25
  auth-ui                  ~140     2026-09-27

Measured sessions (Claude Code plugin):
  Conversation size when sessions ended: ~48,200 tokens on average, ~96,000 at most (12 sessions)
  ThreadMind context loaded at session start: ~1,150 tokens on average (14 sessions)

Summary and context sizes are estimates (~3.5 characters per token); conversation sizes come from the Claude Code transcripts.
```

Without the plugin, the measured section explains how to get measurements. Conversation sizes are read from the transcripts' usage data by the plugin's `SessionEnd` hook; see [Claude Code Plugin](/guide/claude-code-plugin#measured-statistics).

---

## Hook Tool

### `threadmind_hook`

The endpoint of the [Claude Code plugin](/guide/claude-code-plugin#hooks-and-files)'s hooks. It only exists when the server runs with `THREADMIND_HOOKS=1`, as the plugin starts it; the AI is told never to call it.

**Parameters:** `event` (`session-start`, `stop`, `pre-compact`, `user-prompt`, `file-edited` or `branch-check`), plus the fields of the Claude Code hook input that event needs: `session_id`, `transcript_path`, `source`, `trigger`, `stop_hook_active`, `prompt`, `file_path`.

**Returns:** A Claude Code hook output in JSON, or no content when the hook has nothing to do.

---

## Error Handling

All tools follow the same error pattern:

```json
{
  "content": [{ "type": "text", "text": "Error: No ThreadMind project in this workspace. Only create one (project_create) if the user asks for it." }],
  "isError": true
}
```

Thread and project IDs only accept lowercase letters, digits and hyphens. Any other value (including paths such as `../`) is rejected before the tool runs, with an `Input validation error`.

Common errors:
- `"No ThreadMind project in this workspace…"` — no project yet
- `"No active project. Existing projects: … Use project_switch to select one."` — several projects, none selected
- `"Thread \"x\" not found"` — the thread is not in the project
- `"Parent thread \"x\" not found"` — invalid parent for thread creation
- `"Cannot delete the main thread"`, `"Cannot rebase the main thread"`, `"The main thread cannot be closed"`
- `"\"x\" is a descendant of \"y\""` — circular reference detected during rebase
- `"Cannot update thread \"x\": owned by \"y\""` — ownership violation in team mode
- `"... its descendants include threads owned by others"` — team mode deletion that would cascade to a teammate's threads
