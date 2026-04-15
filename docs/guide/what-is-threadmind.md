# What is ThreadMind?

ThreadMind MCP is a [Model Context Protocol](https://modelcontextprotocol.io/) server that organizes AI conversations into **hierarchical thread trees**.

## The Problem

When you work with an AI coding assistant, every new message includes the **entire conversation history** as context. This means:

- **Token waste** — repeating thousands of tokens of already-processed information
- **Context limits** — hitting the model's context window, losing early messages
- **Tangled topics** — authentication logic mixed with UI discussions mixed with deployment questions

```
Message 1 → Message 2 → ... → Message 80 → Message 81
                                              ↑
                        All 80 messages sent as context
                        = tens of thousands of tokens
```

## The Solution

ThreadMind replaces linear history with a **tree of summarized threads**:

```
main (summary: 200 tokens)
├── auth (summary: 150 tokens)
│   ├── auth-ui (summary: 100 tokens) ← active
│   └── auth-api (summary: 120 tokens)
└── dashboard (summary: 180 tokens)
```

When you're working on `auth-ui`, only the **direct ancestor chain** is sent as context:

```
main → auth → auth-ui = ~450 tokens
```

That's it. The `dashboard` branch and `auth-api` sibling are not included — they're irrelevant to your current focus.

## Key Benefits

### Drastically Reduce Token Usage

Instead of sending 50+ messages of raw conversation, you send 2-5 concise summaries. Typical reduction: **80-95%** of tokens.

### Explore Multiple Approaches

Want to try a different architecture? Create a branch:

```
main
├── approach-a (REST API)
│   └── implementation
└── approach-b (GraphQL)     ← switch here to explore
    └── implementation
```

Each branch maintains its own context. Switch freely without contaminating other explorations.

### Collaborate with Your Team

In team mode, thread trees are shared via git:
- Pull teammates' threads to see their progress
- Branch from their work to build on it
- Each person manages their own summaries

### Stay Organized

Every topic gets its own thread. No more scrolling through hundreds of messages to find that one decision about the database schema.

## How It Integrates

ThreadMind is an **MCP server** that works alongside your AI client:

```
┌─────────────┐       MCP Protocol       ┌──────────────┐
│  AI Client   │◄────────────────────────►│  ThreadMind  │
│ (Claude Code,│    tools & resources     │  MCP Server  │
│  ChatGPT,    │                          │              │
│  Gemini...)  │                          │  .threadmind/│
└─────────────┘                           └──────────────┘
```

The AI client calls ThreadMind's **tools** (create threads, update summaries, get context) and reads its **resources** (assembled context, tree visualization). ThreadMind handles all the storage and context assembly logic.

## Next Steps

- [Getting Started](/guide/getting-started) — install and configure ThreadMind
- [Projects](/guide/projects) — understand project management
- [Threads](/guide/threads) — learn about thread trees
- [Context Assembly](/guide/context-assembly) — how context is built
