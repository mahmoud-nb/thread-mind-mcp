# Threads

A **thread** is a node in the tree representing a specific discussion topic or area of work. Each thread stores a concise markdown summary.

## Thread Tree

Threads form a tree rooted at the `main` thread:

```
main
├── auth
│   ├── auth-ui
│   └── auth-api
├── database
│   └── migrations
└── deployment
```

Each thread has exactly one parent (except `main`, which has none) and can have multiple children.

## Creating Threads

```
thread_create(title: "Auth System", parentId: "main")
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | required | Thread title |
| `parentId` | string | active thread | Parent to branch from |

If `parentId` is omitted, the new thread branches from the **currently active thread**.

The new thread automatically becomes the active thread.

### ID Generation

Thread IDs follow the same slugification rules as projects:

| Title | ID |
|-------|------|
| `"Auth System"` | `auth-system` |
| `"API v2 Routes"` | `api-v2-routes` |

Duplicates get numeric suffixes: `auth-system-2`.

## Switching Threads

```
thread_switch(threadId: "auth-ui")
```

Switches the active thread. The tool returns a preview of the assembled context for confirmation.

## Viewing the Tree

```
thread_list
```

Returns an ASCII tree with the active thread marked:

```
main
├── auth
│   ├── auth-ui ← active
│   └── auth-api
├── database
│   └── migrations
└── deployment
```

## Updating Summaries

```
summary_update(content: "Implemented JWT auth with...", threadId: "auth")
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `content` | string | required | New summary (markdown) |
| `threadId` | string | active thread | Thread to update |

### Writing Good Summaries

Summaries are the core of ThreadMind's value. They should be:

- **Concise** — 5-15 lines, capturing the essence
- **Decision-focused** — what was decided and why
- **Actionable** — what was implemented, what's the current state

**Good summary:**
```markdown
Implemented JWT-based authentication:
- Access tokens (15min) + refresh tokens (7d)
- bcrypt for password hashing, salt rounds: 12
- Passport.js local strategy for login
- Tokens stored in httpOnly cookies (not localStorage)
- Decision: no OAuth for v1, will add in v2
```

**Bad summary:**
```markdown
We talked about auth and decided to use JWT.
The AI suggested several options and we picked one.
```

## Deleting Threads

```
thread_delete(threadId: "auth-api")
```

Deletes the thread **and all its descendants**. The `main` thread cannot be deleted.

If the active thread is deleted, the active thread resets to `main`.

In team mode, you can only delete threads you authored.

## Thread File Format

Each thread is stored as a Markdown file with YAML frontmatter:

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
Using bcrypt for password hashing. Passport.js local strategy.
Decision: no OAuth for v1.
```

The frontmatter contains metadata; the body is the summary content.
