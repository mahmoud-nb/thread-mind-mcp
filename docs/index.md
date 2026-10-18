---
layout: home

hero:
  name: ThreadMind MCP
  text: Branches for your AI's memory.
  tagline: A git-friendly tree of thread summaries. Start fresh sessions with the decisions that matter, not the whole history.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/mahmoud-nb/thread-mind-mcp
    - theme: alt
      text: npm
      link: https://www.npmjs.com/package/thread-mind-mcp

features:
  - icon: "\U0001F333"
    title: Thread Trees
    details: Structure your work as a tree of threads. Each thread inherits the decisions and constraints of its ancestors.
  - icon: "\u26A1"
    title: Fresh Sessions, Full Memory
    details: Clear a long conversation and start again from the thread's context. The Claude Code plugin reloads it automatically and measures the difference.
  - icon: "\U0001F500"
    title: Follows Your Git Branches
    details: A thread created on a feature branch becomes active whenever that branch is checked out, and warns when the code it describes has changed.
  - icon: "\U0001F465"
    title: Team Collaboration
    details: Thread files are committed with the code. Branch from teammates' threads; each member owns their own summaries.
  - icon: "\U0001F4C1"
    title: File-Based Storage
    details: Everything is readable Markdown and JSON in a .threadmind/ directory. No database, no index to conflict in git.
  - icon: "\U0001F50C"
    title: MCP Standard
    details: Works with any MCP client — Claude Code, Cursor, Codex, Copilot and more.
---

## Quick Setup

In Claude Code, install the plugin:

```
/plugin marketplace add mahmoud-nb/thread-mind-mcp
/plugin install thread-mind@thread-mind
```

In any other MCP client, add the server ([where each client declares it](/guide/other-clients)):

::: code-group

```json [macOS / Linux]
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

```json [Windows]
{
  "mcpServers": {
    "thread-mind": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "thread-mind-mcp"],
      "env": {}
    }
  }
}
```

:::

Then start organizing:

```
You: Create a project called "My App"
AI:  ✓ Project "my-app" created. Main thread active.

You: Create a thread for "Authentication"
AI:  ✓ Thread "authentication" created under "main".

     main
     └── authentication ← active
```

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #6d28d9 30%, #a855f7);
  --vp-home-hero-image-background-image: linear-gradient(-45deg, #6d28d9aa 50%, #a855f7aa 50%);
  --vp-home-hero-image-filter: blur(44px);
}
</style>
