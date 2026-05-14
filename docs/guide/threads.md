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

Or using the shortcut: `tm:create Auth System`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | required | Thread title |
| `parentId` | string | active thread | Parent to branch from |

If `parentId` is omitted, the new thread branches from the **currently active thread**.

The new thread automatically becomes the active thread.

### Parent summary warning

When a child thread is created, ThreadMind checks whether the parent thread already has a summary. If not, a warning is shown:

```
Thread "auth-system" created under "main".

main
└── auth-system ← active

⚠️  Parent thread "main" has no summary yet.
Run `tm:summary` on "main" before continuing — this ensures the context
chain is complete when you call `context_get` from child threads.
```

This is **non-blocking** — the child thread is always created. The warning is a reminder to document the parent before branching, so that `context_get` can assemble a complete context chain for future sessions.

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

Or using the shortcut: `tm:switch auth-ui`

Switches the active thread. The tool returns a preview of the assembled context for confirmation.

## Viewing the Tree

```
thread_list
```

Or using the shortcut: `tm:tree`

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

Or using the shortcut: `tm:summary` (auto-generates) or `tm:summary <content>`

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

Or using the shortcut: `tm:delete auth-api`

Deletes the thread **and all its descendants**. The `main` thread cannot be deleted.

If the active thread is deleted, the active thread resets to `main`.

In team mode, you can only delete threads you authored.

## Rebasing Threads

Rebasing moves a thread (and all its descendants) to a different parent — similar to `git rebase`.

```
thread_rebase(threadId: "auth-ui", newParentId: "dashboard")
```

Or using the shortcut: `tm:rebase auth-ui dashboard`

**Before:**
```
main
├── auth
│   └── auth-ui
└── dashboard
```

**After `tm:rebase auth-ui dashboard`:**
```
main
├── auth
└── dashboard
    └── auth-ui
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `threadId` | string | Yes | Thread to move |
| `newParentId` | string | Yes | New parent thread |

**Constraints:**
- Cannot rebase the `main` thread
- Cannot create circular references (cannot rebase onto a descendant)
- Cannot rebase a thread onto itself or its current parent
- In team mode, only the thread's author can rebase it

**Side effects:**
- Updates tree structure (old parent loses child, new parent gains child)
- Updates thread frontmatter (`parentId`, `updatedAt`)
- All descendants move with the thread automatically

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
