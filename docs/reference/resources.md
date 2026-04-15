# Resources Reference

ThreadMind exposes 2 MCP resources. Resources provide read-only data that MCP clients can display or inject.

## `threadmind://context`

**Name:** `current-context`

**MIME type:** `text/markdown`

**Description:** The assembled context for the active thread, identical to the output of the `context_get` tool.

### Response Format

Returns a Markdown document with sections separated by `---`:

```markdown
## System Context

Your system prompt here...

---

## Thread: Root Thread

Root summary content...

---

## Thread: Child Thread (active)

Active thread summary...
```

### When No Project Is Active

Returns a plain text message:
```
No active project or thread. Use project_create first.
```

### Usage

MCP clients that support resources can:
- Display the resource content in a panel
- Auto-inject it into the conversation context
- Subscribe to updates (ThreadMind sends `notifications/resources/updated` after mutations)

---

## `threadmind://tree`

**Name:** `thread-tree`

**MIME type:** `text/plain`

**Description:** ASCII tree visualization of the thread hierarchy for the active project.

### Response Format

```
main
├── auth
│   ├── auth-ui ← active
│   └── auth-api
├── database
│   └── migrations
└── deployment
```

### When No Project Is Active

Returns:
```
No active project. Use project_create first.
```

---

## Resource Updates

Both resources reflect the **current state** at the time of reading. After any mutation tool (`project_create`, `thread_create`, `thread_switch`, `summary_update`, `thread_delete`), the resource contents will change.

MCP clients that subscribe to resource notifications will be notified of updates automatically.
