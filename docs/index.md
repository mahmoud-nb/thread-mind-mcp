---
layout: home

hero:
  name: ThreadMind MCP
  text: Think less tokens, think more.
  tagline: Organize AI conversations into thread trees. Reduce token consumption by replacing full chat histories with structured summaries.
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
    details: Structure your AI conversations as a tree of threads. Each thread inherits context from its ancestors — no more duplicated history.
  - icon: "\u26A1"
    title: Token Optimization
    details: Send only concise summaries instead of full conversation histories. Reduce token usage by 80%+ on long sessions.
  - icon: "\U0001F500"
    title: Branch & Explore
    details: Explore different reasoning paths in separate threads. Switch between branches without losing context.
  - icon: "\U0001F465"
    title: Team Collaboration
    details: Share thread trees via git. Branch from teammates' threads. Each member owns and manages their own summaries.
  - icon: "\U0001F4C1"
    title: File-Based Storage
    details: Everything stored as readable Markdown and JSON in a .threadmind/ directory. No database, fully git-friendly.
  - icon: "\U0001F50C"
    title: MCP Standard
    details: Works with any MCP-compatible AI client — Claude Code, ChatGPT, Gemini, and more. Install with a single npx command.
---

## Quick Setup

Add ThreadMind to your AI client in seconds:

```json
{
  "mcpServers": {
    "thread-mind": {
      "command": "npx",
      "args": ["-y", "thread-mind-mcp"]
    }
  }
}
```

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
