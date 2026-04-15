# Tools Reference

ThreadMind exposes 9 MCP tools. All tools return structured text responses and use `isError: true` on failure.

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

---

### `thread_switch`

Switch to a different thread.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `threadId` | `string` | Yes | Thread ID to switch to |

**Returns:** Confirmation + context preview (first 300 characters).

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

---

### `context_get`

Get the full assembled context for the active thread.

**Parameters:** None

**Returns:** The assembled context string — system context + ancestor summaries from root to active thread.

**Algorithm:**
1. Walk from active thread to root via `parentId`
2. Reverse the chain (root → active)
3. Concatenate system context + summaries
4. Skip threads with empty content

See [Context Assembly](/guide/context-assembly) for details.

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
- `"Cannot update thread \"x\": owned by \"y\""` — ownership violation in team mode
