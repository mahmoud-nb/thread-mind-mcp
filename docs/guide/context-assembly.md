# Context Assembly

Context assembly is ThreadMind's core mechanism — it builds a **focused context** from the thread tree for the AI model.

## How It Works

When you call `context_get` (or `tm:context`), switch threads, read the `threadmind://context` resource, or start a session with the [Claude Code plugin](/guide/claude-code-plugin), ThreadMind:

1. **Starts** at the active thread
2. **Walks up** the tree following `parentId` links until reaching the root
3. **Reverses** the chain (root → ... → active)
4. **Keeps** the whole summary of the active thread, and only the durable sections of its ancestors
5. **Flags** summaries that code changes may have made outdated
6. **Estimates** the token count (~1 token per 3.5 characters)

### Example

Given this tree:

```
main ("Next.js e-commerce...")
├── auth ("JWT auth with refresh tokens...")
│   ├── auth-ui ("Login form, registration page...") ← active
│   └── auth-api ("POST /login, POST /register...")
└── dashboard ("Admin dashboard with charts...")
```

The assembled context for `auth-ui` is:

```markdown
## System Context

Building a Next.js e-commerce application with Stripe.

---

## Thread: My App

## Decisions
- Next.js 15, PostgreSQL, Stripe

---

## Thread: Auth

## Decisions
- JWT with refresh tokens, bcrypt, Passport.js

## Constraints
- Sessions survive a server restart

---

## Thread: Auth UI (active)

_⚠ 2 commits changed src/auth/ui since this summary was written: check it is still accurate._

## Decisions
- Login form with React Hook Form

## State
- Registration page done, password reset pending

---
_ThreadMind context: ~160 tokens | depth: 3 threads_
```

### What's Excluded

- **Sibling threads** (`auth-api` is not included)
- **Other branches** (`dashboard` is not included)
- **Empty summaries** (threads with no content are skipped)
- **Thread-only sections of ancestors**: State, Open questions and Next steps describe where *that* thread stands, not what its descendants need

Summaries without section headings are inherited whole. A sibling's summary is still one step away: read its `threadmind://thread/{id}` resource.

## Outdated Summaries

Each summary update records the git commit it was written on, and optionally the `paths` the thread is about. When assembling the context, ThreadMind counts the commits since:

| Situation | Note under the thread's heading |
|-----------|---------------------------------|
| Commits touched the summary's `paths` | `_⚠ 3 commits changed src/auth since this summary was written: check it is still accurate._` |
| No `paths`, commits since | `_Written 14 commits ago._` |
| The commit is not in the repository's history (rebased away, never pushed) | `_⚠ Written on commit 3f2a9c1, which is not in this repository's history: check this summary is still accurate._` |

Nothing is added when git isn't available or nothing changed.

## Token Budget

`context_get` and `thread_switch` accept `maxTokens`. When the context is larger, ThreadMind leaves out the farthest ancestors first — the active thread always stays — and lists them in the footer:

```
_ThreadMind context: ~480 tokens | depth: 4 threads_
_Left out to fit the token budget: main, backend (readable as threadmind://thread/{id} resources)_
```

If the active thread alone exceeds the budget, its text is cut.

## Where the Savings Come From

ThreadMind does not shrink a conversation in progress: the client sends the whole history with each request. The savings come when you **start over**: after `/clear` or in a new session, the thread's context — usually a few hundred to a few thousand tokens — replaces a history that had grown to tens of thousands.

With the [Claude Code plugin](/guide/claude-code-plugin), that restart is automatic after `/clear` and after compaction, and `stats_show` measures both sides on your own sessions:

```
Measured sessions (Claude Code plugin):
  Conversation size when sessions ended: ~48,200 tokens on average, ~96,000 at most (12 sessions)
  ThreadMind context loaded at session start: ~1,150 tokens on average (14 sessions)
```

Conversation sizes come from the Claude Code transcripts; the other figures are estimates (~3.5 characters per token).

## Context Design Strategies

### Shallow Trees for Simple Projects

```
main
├── feature-a
├── feature-b
└── feature-c
```

Each feature gets its own thread directly under main. Context = main's decisions + current feature.

### Deep Trees for Complex Topics

```
main
└── auth
    └── oauth
        └── google-provider
            └── token-refresh-bug
```

When a topic requires deep exploration, nested threads keep each level focused. Selective inheritance keeps the chain short.

### Hybrid Approach

```
main
├── backend
│   ├── auth
│   │   └── oauth
│   └── api
│       ├── routes
│       └── middleware
└── frontend
    ├── components
    └── state-management
```

Organize by architectural layer, then by feature within each layer.

::: tip
Finished threads don't need to stay in the chain: merge them into their parent with `thread_merge`, so the conclusions move up and the tree stays shallow.
:::

## Safety Guards

- **Circular reference detection** — if a parent chain forms a loop (only possible in hand-edited files), ThreadMind throws an error
- **Max depth limit** — chains are capped at 50 levels to prevent runaway traversal
