# Resources Reference

ThreadMind exposes 2 MCP resources and 1 resource template. Resources provide read-only data that MCP clients can display or inject.

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
- Inject it into the conversation context

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

## `threadmind://thread/{threadId}`

**Name:** `thread` (resource template)

**MIME type:** `text/markdown`

**Description:** The summary of one thread of the active project, without its ancestors. The details line shows the status, linked branch and paths when set.

Every thread of the active project is listed as a resource (named by its ID, titled by its thread title), and the `threadId` variable supports autocompletion. In Claude Code, type `@` to mention one and bring a sibling thread's summary into the conversation without switching threads.

### Response Format

```markdown
# Auth API Endpoints

_Thread `auth-api` · parent: auth · branch: feature/auth-api · author: sarah-7b2c · updated: 2026-04-15T12:30:00Z · paths: src/api_

POST /auth/login, POST /auth/register, POST /auth/refresh...
```

Reading a thread that is not in the active project's tree returns an error.

---

## Resource Updates

Resources reflect the **current state** at the time of reading. ThreadMind sends `notifications/resources/list_changed` when the list of thread resources changes (`project_create`, `project_switch`, `thread_create`, `thread_delete`). It does not support subscriptions: clients read a resource again to get its current content.
