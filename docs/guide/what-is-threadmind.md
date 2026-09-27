# What is ThreadMind?

ThreadMind MCP is a [Model Context Protocol](https://modelcontextprotocol.io/) server that gives AI coding sessions a memory: a **tree of threads**, each holding a short summary of what was decided about one topic. The summaries live as Markdown files in your repository.

## The Problem

A long conversation with an AI assistant carries its whole history: every message, tool result and abandoned idea is sent again with each request. It grows until the client compacts it or you start over, and starting over means losing what was decided.

Topics also get tangled: authentication, UI details and deployment questions end up in the same history.

## The Solution

ThreadMind keeps what matters as a tree of summaries:

```
main
├── auth
│   ├── auth-ui ← active
│   └── auth-api
└── dashboard
```

The context of a thread is its own summary plus the **decisions and constraints** of its ancestors. Sibling branches (`auth-api`, `dashboard`) stay out.

So you can start over cheaply: run `/clear` or open a new session, and the thread's context, usually a few hundred to a few thousand tokens, replaces a history that had grown to tens of thousands. With the [Claude Code plugin](/guide/claude-code-plugin), this reload is automatic, and `stats_show` measures both sizes on your own sessions.

::: info
ThreadMind cannot shrink a conversation in progress: the client decides what it sends to the model. The savings come when a session starts from the thread's context instead of a long history.
:::

## Key Benefits

### Start fresh without losing decisions

Summaries are organized in sections (Decisions, Constraints, State, Open questions, Next steps). Child threads inherit only the durable part, so each level stays short.

### Explore Multiple Approaches

Want to try a different architecture? Create a branch:

```
main
├── approach-a (REST API)
│   └── implementation
└── approach-b (GraphQL)
```

Each branch keeps its own context. When an approach wins, merge its conclusions into the parent; when it loses, mark it abandoned with the reason, so the tree remembers why.

### Follow your git branches

A thread created on a feature branch is linked to it: check out the branch, and its thread becomes the active one, for you and for teammates who pull it. Summaries also record the commit they were written on, so ThreadMind can warn when the code they describe has changed since.

### Collaborate with Your Team

Thread files are plain Markdown committed with the code: teammates see each other's decisions, branch from them, and review them in pull requests.

## How It Integrates

ThreadMind is an **MCP server** that works alongside your AI client:

```
┌──────────────┐      MCP Protocol       ┌──────────────┐
│  AI Client   │◄───────────────────────►│  ThreadMind  │
│ (Claude Code,│   tools, resources,     │  MCP Server  │
│  Cursor,     │   prompts, instructions │              │
│  Codex...)   │                         │ .threadmind/ │
└──────────────┘                         └──────────────┘
```

The server tells the client how to use it (MCP server instructions). The AI calls its **tools** (create threads, update summaries, get context) and reads its **resources** (assembled context, tree, individual threads).

## Next Steps

- [Getting Started](/guide/getting-started) — install and configure ThreadMind
- [Claude Code Plugin](/guide/claude-code-plugin) — automatic context at session start
- [Threads](/guide/threads) — the thread tree, sections, statuses and git branches
- [Context Assembly](/guide/context-assembly) — how context is built
