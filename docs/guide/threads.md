# Threads

A **thread** is a node in the tree representing a specific discussion topic or area of work. Each thread stores a concise markdown summary.

## Thread Tree

Threads form a tree rooted at the `main` thread:

```
main
├── auth
│   ├── auth-ui ← active
│   └── auth-api
├── database
│   └── migrations
└── deployment
```

Each thread has exactly one parent (except `main`, which has none) and can have multiple children. Each thread file records its parent: the tree is rebuilt from the files, so there is no separate index to keep in sync.

## Creating Threads

```
thread_create(title: "Auth System", parentId: "main")
```

Or using the shortcut: `tm:create Auth System`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | required | Thread title |
| `parentId` | string | active thread | Parent to branch from |

If `parentId` is omitted, the new thread branches from the **currently active thread**. The new thread becomes the active thread of the session.

On a feature branch, the new thread is also [linked to that branch](#git-branches).

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

This is **non-blocking** — the child thread is always created.

### ID Generation

Thread IDs follow the same slugification rules as projects:

| Title | ID |
|-------|------|
| `"Auth System"` | `auth-system` |
| `"API v2 Routes"` | `api-v2-routes` |

Duplicates get numeric suffixes: `auth-system-2`. Accents are stripped (`"Système"` → `systeme`); titles without any Latin letter or digit get the ID `thread` (then `thread-2`…). In `thread_list`, the title is shown next to IDs that don't reflect it, e.g. `thread — 认证模块`.

## The Active Thread

Each session has its own active thread: switching threads in one Claude Code session doesn't move another session open on the same repository.

```
thread_switch(threadId: "auth-ui")
```

Or using the shortcut: `tm:switch auth-ui`

`thread_switch` returns the full context of the new thread, so the AI doesn't need to call `context_get` afterwards. It accepts the same `maxTokens` budget as `context_get`.

A new session starts on:

1. The last thread used on the checked-out git branch
2. Otherwise, the thread linked to that branch
3. Otherwise, the last thread used, unless it is linked to another branch
4. Otherwise, `main`

## Git Branches

A thread created on a feature branch is linked to it (`branch` in its frontmatter), unless an open thread is already linked to that branch. Base branches (`main`, `master`, `develop`, `dev`, `trunk` and the remote's default branch) are never linked.

```
$ git switch -c feature/auth-ui
tm:create Auth UI
  → thread "auth-ui", linked to feature/auth-ui

(new session on the same branch)
  → active thread: auth-ui

$ git switch main
  → active thread: the last one used on main
```

The link is committed with the thread file, so a teammate who checks out your branch starts on its thread too. If you check out another branch during a session, the active thread follows at the next ThreadMind call.

## Viewing the Tree

```
thread_list
```

Or using the shortcut: `tm:tree`

```
main
├── auth
│   ├── auth-ui [branch: feature/auth-ui] ← active
│   └── auth-api
├── graphql [abandoned]
└── deployment
```

## Updating Summaries

Summaries use these sections, leaving out the empty ones:

```markdown
## Decisions
- JWT access tokens (15 min) + refresh tokens (7 days), in httpOnly cookies
- No OAuth for v1

## Constraints
- Sessions must survive a server restart

## State
- Login and refresh done, logout pending

## Open questions
- Rotate refresh tokens on each use?

## Next steps
- Implement logout
```

Child threads inherit only **Decisions** and **Constraints** (and any section of your own): State, Open questions and Next steps concern the thread itself. Summaries without these headings are inherited whole. The French headings (`## Décisions`, `## Contraintes`, `## État`, `## Questions ouvertes`, `## Prochaines étapes`) are recognized too.

```
summary_update(content: "...")                                        # replaces the whole summary
summary_update(content: "- Refresh tokens", section: "decisions")     # adds to one section
summary_update(content: "- Logout done", section: "state", replaceSection: true)
```

Or using the shortcut: `tm:summary` (the AI writes the summary) or `tm:summary <content>`.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `content` | string | required | The new summary, or the text to add to the section (markdown) |
| `threadId` | string | active thread | Thread to update |
| `section` | string | — | `decisions`, `constraints`, `state`, `open-questions` or `next-steps` |
| `replaceSection` | boolean | `false` | Replace the section instead of adding to it |
| `paths` | string[] | kept | Files or directories the thread is about |

Adding to a section avoids rewriting the whole summary, which costs output tokens and risks dropping details.

### Outdated summaries

Each update records the git commit it was written on. If the summary lists `paths`, the context warns when later commits touched them:

```
## Thread: Auth UI (active)

_⚠ 3 commits changed src/auth since this summary was written: check it is still accurate._
```

Without `paths`, the context only gives the summary's age (`_Written 14 commits ago._`).

### Writing Good Summaries

- **Concise** — a few lines per section
- **Decision-focused** — what was decided and why
- **Self-contained** — readable with no prior context

## Finishing Threads

When a thread's work is done, fold its conclusions into its parent:

```
thread_merge(parentSummary: "...")
```

The AI writes the parent's new summary including the thread's conclusions; ThreadMind saves it, marks the thread `done` and switches to the parent. Shortcut: `tm:merge`.

To close a thread without merging, set its status. The reason goes into the thread's decisions, so the tree remembers why an approach was dropped:

```
thread_status(status: "abandoned", reason: "REST is enough for our clients")
```

Shortcuts: `tm:done [reason]`, `tm:abandon <reason>`. `status: "active"` reopens a thread. The `main` thread can't be closed.

## Deleting Threads

```
thread_delete(threadId: "auth-api")
```

Or using the shortcut: `tm:delete auth-api`

Deletes the thread **and all its descendants**. The `main` thread cannot be deleted. In team mode, you can only delete threads you authored, and not if a descendant belongs to a teammate.

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

**Constraints:**
- Cannot rebase the `main` thread
- Cannot create circular references (cannot rebase onto a descendant)
- Cannot rebase a thread onto itself or its current parent
- In team mode, only the thread's author can rebase it

## Thread File Format

Each thread is stored as a Markdown file with YAML frontmatter:

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
```

`status`, `branch`, `commit`, `paths` and `mergedInto` only appear when set. See [Storage Format](/reference/storage).
