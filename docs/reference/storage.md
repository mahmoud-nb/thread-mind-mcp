# Storage Format Reference

ThreadMind uses file-based storage in a `.threadmind/` directory. All files are human-readable and git-friendly.

## Directory Structure

```
.threadmind/
  .gitignore              # Excludes config.json from version control
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
| `author` | `string` | Unique author ID (`{git_name}-{uuid}`) |
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
```

This ensures that per-user state (active project/thread, author ID) stays local while thread files and tree structures are shared via git.

## Atomic Writes

All file writes use an atomic pattern:
1. Write to a temporary file (`{path}.{uuid}.tmp`)
2. Write to the final path
3. Remove the temporary file

This prevents corruption if the process is interrupted mid-write.

## ID Generation (Slugification)

Both project and thread IDs are generated by slugifying titles:

```
Input                    → Output
"My App"                 → "my-app"
"Auth System v2"         → "auth-system-v2"
"API (REST)"             → "api-rest"
"  Spaces & Symbols!! "  → "spaces--symbols"
```

Rules:
1. Lowercase
2. Replace spaces/underscores with hyphens
3. Remove non-alphanumeric characters (except hyphens)
4. Collapse multiple hyphens
5. Trim leading/trailing hyphens

If a collision exists, append `-2`, `-3`, etc.
