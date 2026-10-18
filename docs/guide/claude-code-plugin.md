# Claude Code Plugin

The ThreadMind plugin for Claude Code bundles the MCP server with hooks, options and a set of commands. It is the recommended setup for Claude Code: the context of the active thread loads by itself at the start of every session, and the plugin keeps its summary saved as the conversation goes on.

## Install

In Claude Code:

```
/plugin marketplace add mahmoud-nb/thread-mind-mcp
/plugin install thread-mind@thread-mind
```

Claude Code installs the ThreadMind server with the plugin, then runs it with `node`: no `npx` and no `cmd /c` wrapper, on Windows as elsewhere. The plugin needs Claude Code 2.1.271 or later.

::: warning
If you configured ThreadMind manually before (`.mcp.json` or `claude mcp add`), remove that configuration: otherwise Claude Code runs two ThreadMind servers.
:::

## What it does

ThreadMind depends on one thing: the AI saving what matters in the thread's summary. The plugin loads that summary when a session starts, then watches that it keeps being saved.

### Context at session start

When a session starts, after `/clear`, and after a compaction, the plugin injects the assembled context of the active thread into the conversation, the same text `context_get` returns. The AI starts with your decisions, and doesn't need to call `context_get`.

This is what makes ThreadMind save tokens in practice: when a conversation has grown long, run `/clear`. The new session starts with the thread's context (usually a few hundred to a few thousand tokens) instead of the whole history.

Claude Code accepts up to 10,000 characters from a hook. A longer context leaves out the farthest ancestors first, then gets cut, and the AI is told to call `context_get` for the parts left out.

Nothing is injected in a repository without a ThreadMind project, and the plugin creates no file there.

### Summary reminders

At the end of each answer, the plugin measures how much the conversation grew since the active thread's summary was last saved, from the token counts in the Claude Code transcript. Every 50,000 tokens of unsaved work, it reminds Claude:

```
Stop hook feedback:
ThreadMind: ~52k tokens of conversation since the summary of thread "api-routes" was last saved.
If this work produced decisions, constraints or progress worth keeping, record them now with
summary_update (one section, or the whole structured summary). Otherwise, end your turn.
```

Claude then saves what matters with `summary_update`, or ends its turn when there was nothing to keep. A reminder is never followed by another one in the same turn, and saving the summary starts the count again.

With the `warn` option, only you see the reminder, as a message in the conversation; Claude isn't interrupted. Reminders stop on threads marked done or abandoned.

### Before the context fills up

When the conversation reaches 70% of the context window with work still unsaved, the plugin sends a last reminder, once, so the summary is saved before Claude Code compacts the conversation. The context window size comes from the [status line](#status-line) when you set it up, from the `context_window` option, or else is assumed to be 200,000 tokens (1,000,000 once the conversation grows past that).

### After a compaction

If a compaction happens anyway while work is unsaved, the plugin notes it just before. The session that resumes after the compaction starts with the thread's context and an instruction to save the summary first, from the conversation summary Claude Code just wrote:

```
The conversation was just compacted before the summary of thread "api-routes" was saved
(~38k tokens of work). Before anything else, call summary_update to record the decisions,
constraints, state and next steps from the conversation summary, then carry on.
```

The plugin never blocks a compaction. Turn this off with the `compact_summary` option: the AI is then only asked to check the compaction summary for missing decisions.

### After `/clear`

`/clear` erases the conversation. If the conversation you cleared had unsaved work, the plugin tells you so when the new session starts, so you know the summary missed it:

```
ThreadMind: the conversation you cleared had ~41k tokens of work that was not saved in thread "api-routes"'s summary.
```

Save the summary (`tm:summary`) before `/clear` to avoid it.

### Git branch changes

When Claude runs `git switch`, `git checkout` or `gh pr checkout`, or when you change branches in your own terminal between two messages, the active thread follows the branch (see [How the active thread is chosen](#how-the-active-thread-is-chosen)). The plugin then gives Claude the context of the new active thread right away, so the work continues in the right thread.

### Edited files recorded with the summary

The plugin notes the files Claude edits. When Claude saves the summary without giving `paths`, these files are recorded with it, so the context [flags the summary](/guide/context-assembly#outdated-summaries) once later commits change them.

### Instant `tm:tree` and `tm:stats`

`tm:tree`, `tm:stats`, `/thread-mind:tree` and `/thread-mind:stats` are answered by the plugin directly, without sending the request to Claude: the answer is instant and uses no tokens. Claude Code shows it as the reason your message wasn't sent to Claude.

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

## Options

Set them in `/config`, in the ThreadMind plugin's rows. They apply from the next session.

| Option | Default | Effect |
|--------|---------|--------|
| Summary reminders (`reminders`) | `nudge` | `nudge`: Claude saves the summary itself. `warn`: only you are told. `off`: no reminders |
| Tokens between reminders (`reminder_tokens`) | `50000` | How much the conversation grows before each reminder |
| Last reminder before compaction (`context_threshold`) | `70` | How full the context window gets, in percent, before the last reminder |
| Save the summary after a compaction (`compact_summary`) | on | Claude saves the summary first thing after a compaction that lost unsaved work |
| Instant tm:tree and tm:stats (`instant_commands`) | on | Answer these shortcuts without Claude |
| Context window size (`context_window`) | `0` | `0` to detect it; set it when you don't use the status line |

## Status line

A status line keeps the state of ThreadMind in view at the bottom of Claude Code:

```
🧵 api-routes · feature/api-routes · saved 2h ago · ⚠ ~54k unsaved · ctx 64%
```

| Part | Meaning |
|------|---------|
| `🧵 api-routes` | The active thread, with `[done]` or `[abandoned]` when closed |
| `feature/api-routes` | The checked-out git branch |
| `saved 2h ago` | When the thread's summary was last saved (`no summary yet` before the first one) |
| `~54k unsaved` | Work the plugin counted since then, flagged with ⚠ past the reminder interval |
| `ctx 64%` | How full the context window is |

A plugin can't set the status line, so add it to your `~/.claude/settings.json`. Install the package once so the command starts fast:

```bash
npm install -g thread-mind-mcp
```

```json
{
  "statusLine": {
    "type": "command",
    "command": "thread-mind-mcp status-line"
  }
}
```

Without the global install, use `"command": "npx -y thread-mind-mcp status-line"`, which starts more slowly. The status line stays empty in repositories without a ThreadMind project. It also reports the real context window size to the plugin, for the [last reminder](#before-the-context-fills-up).

## Checking that ThreadMind does its job

- **The status line** shows the active thread and how much work is unsaved
- **The conversation** shows each ThreadMind tool call; `Ctrl+O` shows their details, and the plugin's reminders appear as `Stop hook feedback`
- **`git diff .threadmind/`** shows what the AI actually wrote in the summaries; in a team, the thread files are reviewed in the pull request
- **`/thread-mind:stats`** shows when each summary was last saved
- **`/thread-mind:context`** shows the context the AI receives

## How the active thread is chosen

Each Claude Code session has its own active thread: switching threads in one session doesn't move the others. A new session starts on:

1. The last thread used on the checked-out git branch
2. Otherwise, the thread linked to that branch (a thread created on a feature branch is linked to it)
3. Otherwise, the last thread used, unless it is linked to another branch
4. Otherwise, `main`

If you check out another branch during a session, the active thread follows, and the plugin tells Claude. See [Threads](/guide/threads#git-branches).

## Hooks and files

| Hook | Runs | Handler |
|------|------|---------|
| `SessionStart` (startup) | When a session starts | Command `thread-mind-mcp hook session-start` |
| `SessionStart` (clear, compact) | After `/clear` and after a compaction | Tool `threadmind_hook`, event `session-start` |
| `UserPromptSubmit` | When you send a message | Tool `threadmind_hook`, event `user-prompt` |
| `PostToolUse` (Edit, Write) | After Claude edits a file | Tool `threadmind_hook`, event `file-edited` |
| `PostToolUse` (Bash) | After `git switch`, `git checkout`, `gh pr checkout` | Tool `threadmind_hook`, event `branch-check` |
| `Stop` | At the end of each answer | Tool `threadmind_hook`, event `stop` |
| `PreCompact` | Before a compaction | Tool `threadmind_hook`, event `pre-compact` |
| `SessionEnd` | When a session ends | Command `thread-mind-mcp hook session-end` |

Most hooks call the `threadmind_hook` tool of the plugin's own server (`mcp_tool` hooks), so they share the session's active thread. Claude Code makes MCP servers available to hooks only once the session has started, so the hooks that run before or after it are commands; they find the project from `THREADMIND_ROOT`, then `CLAUDE_PROJECT_DIR`, then the session's directory.

The plugin starts the server with `THREADMIND_HOOKS=1`, which exposes `threadmind_hook`. Other MCP clients don't see this tool.

## Without the plugin

The hooks also work with a server you [configured yourself](/guide/getting-started#claude-code-without-the-plugin). Add `THREADMIND_HOOKS` to the server's `env`, plus any option below:

| Variable | Option |
|----------|--------|
| `THREADMIND_HOOKS` | `1` exposes the `threadmind_hook` tool |
| `THREADMIND_REMINDERS` | `nudge`, `warn` or `off` |
| `THREADMIND_REMINDER_TOKENS` | Tokens between reminders |
| `THREADMIND_CONTEXT_THRESHOLD` | Last reminder, in percent of the context window |
| `THREADMIND_COMPACT_SUMMARY` | `true` or `false` |
| `THREADMIND_INSTANT_COMMANDS` | `true` or `false` |
| `THREADMIND_CONTEXT_WINDOW` | Context window size in tokens |

Then declare the hooks in `.claude/settings.json` (team) or `~/.claude/settings.json` (you), with `server` set to the name you gave the server. This example adds the reminders and the compaction recovery:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "mcp_tool",
            "server": "thread-mind",
            "tool": "threadmind_hook",
            "input": {
              "event": "stop",
              "session_id": "${session_id}",
              "transcript_path": "${transcript_path}",
              "stop_hook_active": "${stop_hook_active}"
            }
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "mcp_tool",
            "server": "thread-mind",
            "tool": "threadmind_hook",
            "input": {
              "event": "pre-compact",
              "session_id": "${session_id}",
              "transcript_path": "${transcript_path}"
            }
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "clear|compact",
        "hooks": [
          {
            "type": "mcp_tool",
            "server": "thread-mind",
            "tool": "threadmind_hook",
            "input": {
              "event": "session-start",
              "session_id": "${session_id}",
              "source": "${source}"
            }
          }
        ]
      }
    ]
  }
}
```

To load the context when a session starts as well, add a `SessionStart` hook with the `startup` matcher that runs the command `npx -y thread-mind-mcp hook session-start`: tool hooks can't run that early. The plugin's [hooks.json](https://github.com/mahmoud-nb/thread-mind-mcp/blob/master/plugin/hooks/hooks.json) lists the other hooks with their inputs.
