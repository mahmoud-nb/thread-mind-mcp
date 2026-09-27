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
  trees/
    {project-id}.json     # Tree structure index
  stats/
    {project-id}.json     # Token savings statistics
```

## File Formats

### `config.json` (AppState)

Per-user local state. **Gitignored** — each team member has their own.

```json
{
  "activeProjectId": "my-app",
  "activeThreadId": "auth-ui",
  "author": "mahmoud-a3f9",
  "version": 1
}
```

| Field | Type | Description |
|-------|------|-------------|
| `activeProjectId` | `string \| null` | Currently selected project |
| `activeThreadId` | `string \| null` | Currently selected thread |
| `author` | `string` | Author ID (`{git_name}-{4 hex chars derived from git user.email}`), created on first write |
| `version` | `number` | Schema version for migrations |

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
id: auth-system
title: Authentication System
parentId: main
author: mahmoud-a3f9
createdAt: 2026-04-15T10:00:00Z
updatedAt: 2026-04-15T12:30:00Z
---

JWT-based authentication with refresh tokens.
bcrypt for password hashing, salt rounds: 12.
Passport.js local strategy.
```

**Frontmatter fields (ThreadMetadata):**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Thread identifier (matches filename) |
| `title` | `string` | Human-readable thread title |
| `parentId` | `string \| "null"` | Parent thread ID, `"null"` for root |
| `author` | `string` | Author ID who created this thread |
| `createdAt` | `string` | ISO 8601 creation timestamp |
| `updatedAt` | `string` | ISO 8601 last update timestamp |

**Body:** Markdown summary content (can be empty for new threads).

The file name is authoritative for the thread ID: the `id` field is informative only. Values that YAML could misread (`: `, a leading quote or dash, `null`/`true`/`false`, surrounding spaces) are written as double-quoted JSON strings, which are also valid YAML. The block ends at the first line that is exactly `---`, so titles and summaries may contain `---`.

---

### `trees/{project-id}.json` (TreeStructure)

Denormalized index for fast tree traversal:

```json
{
  "nodes": {
    "main": {
      "parentId": null,
      "children": ["auth-system", "dashboard"]
    },
    "auth-system": {
      "parentId": "main",
      "children": ["auth-ui", "auth-api"]
    },
    "auth-ui": {
      "parentId": "auth-system",
      "children": []
    },
    "auth-api": {
      "parentId": "auth-system",
      "children": []
    },
    "dashboard": {
      "parentId": "main",
      "children": []
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `nodes` | `Record<string, TreeNode>` | Map of thread ID to parent/children |
| `nodes[id].parentId` | `string \| null` | Parent thread ID |
| `nodes[id].children` | `string[]` | Ordered list of child thread IDs |

::: info
The tree file is a **denormalized index** — the same parent-child relationships exist in each thread's frontmatter. If the tree file becomes corrupted or has merge conflicts, it can be regenerated from the thread files.
:::

---

### `stats/{project-id}.json` (ProjectStats)

Token savings statistics, updated automatically on every `summary_update` call:

```json
{
  "projectId": "my-app",
  "threads": {
    "main": {
      "updateCount": 4,
      "firstContentLength": 350,
      "currentContentLength": 280,
      "cumulativeInputLength": 1420,
      "lastUpdatedAt": "2026-04-15T14:30:00Z"
    },
    "auth-system": {
      "updateCount": 3,
      "firstContentLength": 200,
      "currentContentLength": 310,
      "cumulativeInputLength": 890,
      "lastUpdatedAt": "2026-04-15T16:00:00Z"
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | `string` | Project this stats file belongs to |
| `threads` | `Record<string, SummaryStats>` | Per-thread statistics |
| `threads[id].updateCount` | `number` | How many times `summary_update` was called |
| `threads[id].firstContentLength` | `number` | Character length of the first summary ever written |
| `threads[id].currentContentLength` | `number` | Character length of the latest summary |
| `threads[id].cumulativeInputLength` | `number` | Sum of all content lengths ever submitted |
| `threads[id].lastUpdatedAt` | `string` | ISO 8601 timestamp of last update |

The key metric is the ratio between `cumulativeInputLength` (total text compressed) and `currentContentLength` (current summary size). This measures how much information ThreadMind compresses over time.

::: tip
Stats files are informational only. If deleted, they rebuild naturally as users continue calling `summary_update`. No data is lost — only historical tracking resets.
:::

---

### `.gitignore`

Auto-created inside `.threadmind/`:

```
config.json
.lock
*.tmp
```

This ensures that per-user state (active project/thread, author ID) stays local while thread files and tree structures are shared via git.

## Atomic Writes

All file writes use an atomic pattern:
1. Write to a temporary file (`{path}.{uuid}.tmp`) and flush it to disk
2. Rename the temporary file over the final path (on Windows, retried briefly while another process holds the file)
3. On failure, remove the temporary file

A reader therefore sees either the previous or the new version of a file, never a partial one, even if the process is interrupted mid-write.

## Concurrency

Operations that read then modify files (creating, moving or deleting threads, updating summaries, switching the active thread) run one at a time: within a process through an in-memory queue, and across processes (several sessions on the same repository) through the `.threadmind/.lock` file. A lock left behind by a crashed process is reclaimed after 10 seconds.

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
