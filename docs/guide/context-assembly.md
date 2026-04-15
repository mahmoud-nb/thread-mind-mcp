# Context Assembly

Context assembly is ThreadMind's core mechanism — it builds a **focused context** from the thread tree to send to the AI model.

## How It Works

When you call `context_get` or read the `threadmind://context` resource, ThreadMind:

1. **Starts** at the active thread
2. **Walks up** the tree following `parentId` links until reaching the root
3. **Reverses** the chain (root → ... → active)
4. **Concatenates** the system context + all summaries in order

### Example

Given this tree:

```
main ("Project overview: Next.js e-commerce...")
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

Project overview: Next.js e-commerce with PostgreSQL...

---

## Thread: Auth

JWT auth with refresh tokens, bcrypt, Passport.js...

---

## Thread: Auth UI (active)

Login form with email/password, registration page
with validation, forgot password flow...
```

### What's Excluded

- **Sibling threads** (`auth-api` is not included)
- **Other branches** (`dashboard` is not included)
- **Empty summaries** (threads with no content are skipped)

This is intentional — only the **direct ancestral context** matters for the current thread.

## Token Savings

Consider a typical project with 5 levels of threads, each with a 10-line summary (~100 tokens):

| Approach | Tokens Sent |
|----------|-------------|
| Full conversation history (100 messages) | ~50,000 tokens |
| ThreadMind context (5 summaries) | ~500 tokens |
| **Savings** | **~99%** |

Even with generous summaries (500 tokens each), a 5-level chain costs only 2,500 tokens — still a massive reduction.

## Using Context Effectively

### As a Tool

```
context_get
```

Returns the assembled context as text. Use this to explicitly inject context into your conversation.

### As a Resource

The `threadmind://context` resource exposes the same assembled context. MCP clients that support resources can display or auto-inject it.

## Context Design Strategies

### Shallow Trees for Simple Projects

```
main
├── feature-a
├── feature-b
└── feature-c
```

Each feature gets its own thread directly under main. Context = main + current feature.

### Deep Trees for Complex Topics

```
main
└── auth
    └── oauth
        └── google-provider
            └── token-refresh-bug
```

When a topic requires deep exploration, nested threads keep each level focused.

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
The ideal tree depth is **3-5 levels**. Deeper trees mean more context per assembly, partially defeating the purpose. If you go deeper, keep summaries very concise.
:::

## Safety Guards

- **Circular reference detection** — if a parent chain forms a loop (should never happen), ThreadMind throws an error
- **Max depth limit** — chains are capped at 50 levels to prevent runaway traversal
