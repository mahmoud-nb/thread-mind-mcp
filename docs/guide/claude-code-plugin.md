# Claude Code Plugin

The ThreadMind plugin for Claude Code bundles the MCP server with two hooks and a set of commands. It is the recommended setup for Claude Code: the context of the active thread loads by itself at the start of every session.

## Install

In Claude Code:

```
/plugin marketplace add mahmoud-nb/thread-mind-mcp
/plugin install thread-mind@thread-mind
```

Claude Code installs the ThreadMind server with the plugin, then runs it with `node`: no `npx` and no `cmd /c` wrapper, on Windows as elsewhere.

::: warning
If you configured ThreadMind manually before (`.mcp.json` or `claude mcp add`), remove that configuration: otherwise Claude Code runs two ThreadMind servers.
:::

## What it does

### Context at session start

When a session starts, after `/clear`, and after a compaction, the plugin injects the assembled context of the active thread into the conversation, the same text `context_get` returns. The AI starts with your decisions, and doesn't need to call `context_get`.

This is what makes ThreadMind save tokens in practice: when a conversation has grown long, run `/clear`. The new session starts with the thread's context (usually a few hundred to a few thousand tokens) instead of the whole history.

After an automatic compaction, the injected context also asks the AI to record any decision found in the compaction summary but missing from the thread summary, so nothing is lost.

Nothing is injected in a repository without a ThreadMind project, and the hook creates no file there.

### Measured statistics

When a session ends, the plugin reads the size of the conversation from its transcript: the prompt of the last turn plus its answer, as the API reported them. `stats_show` then shows what the sessions actually weighed, next to the context the plugin loaded when they started:

```
Measured sessions (Claude Code plugin):
  Conversation size when sessions ended: ~48,200 tokens on average, ~96,000 at most (12 sessions)
  ThreadMind context loaded at session start: ~1,150 tokens on average (14 sessions)
```

Measurements stay in `.threadmind/config.json`, which is not committed. The last 50 sessions are kept.

### Commands

| Command | Action |
|---------|--------|
| `/thread-mind:context` | Reload the context of the active thread |
| `/thread-mind:tree` | Show the thread tree |
| `/thread-mind:create <title>` | Create a thread under the active one |
| `/thread-mind:switch <thread-id>` | Switch this session to another thread |
| `/thread-mind:summary [what to record]` | Record a point in the right section, or rewrite the whole summary |
| `/thread-mind:merge` | Fold the finished thread into its parent |
| `/thread-mind:stats` | Show statistics |

The `tm:` text shortcuts and the MCP prompts keep working alongside.

## How the active thread is chosen

Each Claude Code session has its own active thread: switching threads in one session doesn't move the others. A new session starts on:

1. The last thread used on the checked-out git branch
2. Otherwise, the thread linked to that branch (a thread created on a feature branch is linked to it)
3. Otherwise, the last thread used, unless it is linked to another branch
4. Otherwise, `main`

If you check out another branch during a session, the active thread follows at the next ThreadMind call. See [Threads](/guide/threads#git-branches).

## Hooks and files

| Hook | Runs | Command |
|------|------|---------|
| `SessionStart` | At startup, after `/clear` and after a compaction | `thread-mind-mcp hook session-start` |
| `SessionEnd` | When a session ends | `thread-mind-mcp hook session-end` |

The hooks find the project from `THREADMIND_ROOT`, then `CLAUDE_PROJECT_DIR`, then the session's directory.
