# Storage Format Reference

ThreadMind uses file-based storage in a `.threadmind/` directory. All files are human-readable and git-friendly.

## Directory Structure

```
.threadmind/
  .gitignore              # Excludes config.json from version control
  .lock                   # Transient lock, present only while a write is in progress
  config.json             # Local user state (gitignored)
  projects/
    {project-id}.json     # Project configuration
  threads/
    {project-id}/
      {thread-id}.md      # Thread files (frontmatter + summary)
```

The thread files are the tree: each one records its parent, and ThreadMind rebuilds the tree from them. There is no separate index to keep in sync or to conflict in git.

## File Formats

### `config.json` (AppState)

Per-user local state. **Gitignored** — each team member has their own.

```json
{
  "activeProjectId": "my-app",
  "activeThreadId": "auth-ui",
  "author": "mahmoud-a3f9",
  "version": 1,
  "branchThreads": {
    "my-app": { "main": "main", "feature/auth-ui": "auth-ui" }
  },
  "sessions": [
    {
      "sessionId": "b1f3…",
      "projectId": "my-app",
      "startedAt": "2026-09-27T09:00:00.000Z",
      "source": "clear",
      "injectedTokens": 1150,
      "endedAt": "2026-09-27T11:40:00.000Z",
      "endReason": "clear",
      "finalContextTokens": 48200
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `activeProjectId` | `string \| null` | Last project used: where new sessions start |
| `activeThreadId` | `string \| null` | Last thread used, the fallback outside git |
| `author` | `string` | Author ID (`{git_name}-{4 hex chars derived from git user.email}`), created on first write |
| `version` | `number` | Schema version for migrations |
| `branchThreads` | `object` | Last thread used on each git branch, per project |
| `sessions` | `array` | The last 50 sessions measured by the [Claude Code plugin](/guide/claude-code-plugin) |

Each session keeps its own active thread in memory; this file only holds where the next session starts.

---

### `projects/{id}.json` (ProjectConfig)

```json
{
  "id": "my-app",
  "title": "My App",
  "systemContext": "Building a Next.js e-commerce application",
  "mode": "solo",
  "rootThreadId": "main"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Slugified project identifier |
| `title` | `string` | Human-readable project name |
| `systemContext` | `string` | Global system prompt |
| `mode` | `"solo" \| "team"` | Collaboration mode |
| `rootThreadId` | `string` | Always `"main"` |

---

### `threads/{project-id}/{thread-id}.md` (ThreadNode)

Markdown file with YAML frontmatter:

```markdown
---
id: auth-ui
title: Auth UI
parentId: auth
author: mahmoud-a3f9
createdAt: 2026-04-15T10:00:00.000Z
updatedAt: 2026-04-15T12:30:00.000Z
branch: feature/auth-ui
commit: 3f2a9c1e5b7d4a8f0c6e2b1d9a7f5c3e1b0d8a6f
paths: ["src/auth"]
---

## Decisions
- Login form with React Hook Form

## State
- Registration done, password reset pending
```

**Frontmatter fields (ThreadMetadata):**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Thread identifier (matches filename) |
| `title` | `string` | Human-readable thread title |
| `parentId` | `string \| "null"` | Parent thread ID, `"null"` for root |
| `author` | `string` | Author ID who created this thread |
| `createdAt` | `string` | ISO 8601 creation timestamp; orders children in the tree |
| `updatedAt` | `string` | ISO 8601 last update timestamp |
| `status` | `"done" \| "abandoned"` | Absent for an active thread |
| `branch` | `string` | Git branch the thread is linked to |
| `commit` | `string` | HEAD commit when the summary was last written |
| `paths` | `string[]` | Files or directories the summary covers, to flag it when they change |
| `mergedInto` | `string` | Parent the thread was merged into |

The last five fields only appear when set. **Body:** Markdown summary, ideally with the sections `## Decisions`, `## Constraints`, `## State`, `## Open questions`, `## Next steps` (see [Threads](/guide/threads#updating-summaries)).

The file name is authoritative for the thread ID: the `id` field is informative only. Values that YAML could misread (`: `, a leading quote or dash, `null`/`true`/`false`, surrounding spaces) are written as double-quoted JSON strings, which are also valid YAML. The block ends at the first line that is exactly `---`, so titles and summaries may contain `---`.

A thread whose parent file is missing is shown as a root, so it stays visible.

---

### `.gitignore`

Auto-created inside `.threadmind/`:

```
config.json
.lock
*.tmp
```

This ensures that per-user state (active project/thread, author ID, session measurements) stays local while thread files are shared via git.

## Upgrading from 0.4

Earlier versions also wrote:

- `trees/{project-id}.json`, an index duplicating each thread's parent. It was the one actually read, so on first use ThreadMind aligns the thread files on it, then deletes it.
- `stats/{project-id}.json`, the old estimated statistics. It is no longer read or written, and can be deleted.

## Atomic Writes

All file writes use an atomic pattern:
1. Write to a temporary file (`{path}.{uuid}.tmp`) and flush it to disk
2. Rename the temporary file over the final path (on Windows, retried briefly while another process holds the file)
3. On failure, remove the temporary file

A reader therefore sees either the previous or the new version of a file, never a partial one, even if the process is interrupted mid-write.

## Concurrency

Operations that read then modify files (creating, moving or deleting threads, updating summaries, recording the active thread) run one at a time: within a process through an in-memory queue, and across processes (several sessions on the same repository, the plugin's hooks) through the `.threadmind/.lock` file. A lock left behind by a crashed process is reclaimed after 10 seconds.

## ID Generation (Slugification)

Both project and thread IDs are generated by slugifying titles:

```
Input                          → Output
"My App"                       → "my-app"
"Auth System v2"               → "auth-system-v2"
"API (REST)"                   → "api-rest"
"  Spaces & Symbols!! "        → "spaces-symbols"
"Système d'authentification"   → "systeme-dauthentification"
"认证模块"                       → "thread" (or "project")
```

Rules:
1. Strip accents (`é` → `e`, `œ` → `oe`) and lowercase
2. Replace spaces/underscores with hyphens
3. Remove characters other than `a-z`, `0-9` and hyphens
4. Collapse multiple hyphens, trim leading/trailing hyphens, cap at 64 characters
5. If nothing is left, use `thread` (or `project`)

If a collision exists, append `-2`, `-3`, etc. Line breaks in titles are collapsed into spaces.

IDs are restricted to lowercase letters, digits and hyphens: tools reject any other ID, which also rules out paths such as `../`.
