# ThreadMind tools

Each session has its own active project and thread. Tools that take an optional `threadId` work on the active thread when it is omitted. Thread and project IDs only accept lowercase letters, digits and hyphens.

## Projects

| Tool | Parameters | Does |
|------|------------|------|
| `project_create` | `title`, `systemContext?`, `mode?` (`solo` or `team`) | Creates a project with a `main` thread and makes it active |
| `project_list` | | Lists the projects |
| `project_switch` | `projectId` | Makes another project active |

In `team` mode, thread files are meant to be committed, and each person can only change the threads they created.

## Threads

| Tool | Parameters | Does |
|------|------------|------|
| `thread_list` | | Shows the thread tree, with statuses and linked git branches |
| `thread_create` | `title`, `parentId?` | Creates a thread under the active one (or `parentId`) and makes it active |
| `thread_switch` | `threadId`, `maxTokens?` | Makes a thread active and returns its context |
| `thread_status` | `status` (`active`, `done`, `abandoned`), `threadId?`, `reason?` | Closes or reopens a thread; the reason goes into its decisions |
| `thread_merge` | `parentSummary`, `threadId?` | Replaces the parent's summary, marks the thread done and switches to the parent |
| `thread_rebase` | `threadId`, `newParentId` | Moves a thread and its descendants under another parent |
| `thread_delete` | `threadId` | Deletes a thread and all its descendants |

## Summaries and context

| Tool | Parameters | Does |
|------|------------|------|
| `context_get` | `maxTokens?` | Returns the active thread's summary plus the decisions and constraints of its ancestors |
| `summary_update` | `content`, `threadId?`, `section?`, `replaceSection?`, `paths?` | Updates one section of a summary, or replaces the whole summary |
| `stats_show` | | Shows summary sizes and, with the Claude Code plugin, measured conversation sizes |

`section` is one of `decisions`, `constraints`, `state`, `open-questions`, `next-steps`. With `maxTokens`, the farthest ancestors are left out first to fit the budget.

## Setup

| Tool | Parameters | Does |
|------|------------|------|
| `threadmind_init` | `clients?` (`agents`, `claude`, `cursor`, `generic`) | Writes the ThreadMind usage instructions into `AGENTS.md` (default) or other instruction files, for agents that don't read the server's instructions |

## Resources and prompts

The server also exposes each thread as a resource (`threadmind://thread/{id}`) and the `tm:` shortcuts as MCP prompts (`tm-tree`, `tm-summary`…), which some agents show as slash commands.
