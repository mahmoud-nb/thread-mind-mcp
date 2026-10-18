---
name: thread-mind
description: Keeps the context of a coding project across AI sessions as a git-friendly tree of thread summaries, through the ThreadMind MCP server. Use when the user asks to save or record decisions, to resume or reload the context of earlier work, to start a new topic or sub-task as its own thread, to see the thread tree, or types a tm: shortcut such as tm:summary, tm:tree or tm:context.
license: MIT
compatibility: Needs the ThreadMind MCP server (npm package thread-mind-mcp, Node.js 18 or later) in the agent's MCP configuration. Works with any MCP client, including Claude Code, Cursor, VS Code, GitHub Copilot CLI, Codex, Gemini CLI and Windsurf.
---

# ThreadMind

ThreadMind keeps the context of a project across AI sessions. It stores a tree of threads in the `.threadmind/` directory of the project. Each thread holds a short markdown summary of one topic. The context of a thread is its own summary plus the decisions and constraints of its ancestors, so a new session starts from what matters instead of the whole history. Summaries are plain files that a team can commit and review with git.

This skill drives the tools of the ThreadMind MCP server: `context_get`, `summary_update`, `thread_list` and the others listed in [references/tools.md](references/tools.md).

## 1. Check that ThreadMind is available

- If tools named `context_get`, `summary_update` and `thread_list` are available, go on. Some agents prefix them with the server name, such as `mcp__thread-mind__context_get`.
- If they aren't, the ThreadMind MCP server isn't set up. Tell the user, and show them the configuration for their agent from [references/setup.md](references/setup.md). Don't edit configuration files or install anything unless the user asks you to.

## 2. Load the context when a conversation starts

1. Call `context_get` once, unless the ThreadMind context is already in the conversation (the Claude Code plugin loads it by itself).
2. If it reports that there is no ThreadMind project, carry on without ThreadMind, and don't call its tools again unless the user asks. Only create a project (`project_create`) when the user asks for it.
3. Treat the Decisions and Constraints of the context as settled: follow them, and point out when a request contradicts one of them.

## 3. Save what matters as you go

After a decision, a newly found constraint or a completed task, call `summary_update` with a `section`, so that only that section changes:

| Section | Holds | Update |
|---------|-------|--------|
| `decisions` | Choices made, with their reason in a few words | Add to it |
| `constraints` | What must stay true | Add to it |
| `state` | Where the work stands | Replace it (`replaceSection: true`) |
| `open-questions` | What is still undecided | Add or replace |
| `next-steps` | What to do next | Replace it (`replaceSection: true`) |

- Without `section`, `summary_update` replaces the whole summary: keep everything that is still true.
- Pass `paths` (the files or directories the thread is about) so that the summary gets flagged once later commits change them.
- Keep each entry to one line. A summary is a few hundred tokens, not a transcript: see [references/summaries.md](references/summaries.md).
- Save before the conversation ends, before the user clears it, and whenever a long stretch of work isn't recorded yet.
- Never write secrets, tokens or personal data in a summary: teams commit them to git.

## 4. Organize the work in threads

- When the work moves to another topic, call `thread_list`, then `thread_switch` to an existing thread (it returns that thread's context) or `thread_create` a new one under the current thread.
- A thread created on a git feature branch is linked to it, and becomes the active thread whenever that branch is checked out.
- When a thread is finished, call `thread_merge` with the parent's new summary, which you write to include the thread's conclusions. Or call `thread_status` to mark it `done` or `abandoned`, with the reason.
- Only delete a thread (`thread_delete`) when the user asks: it also deletes its descendants.

## 5. Shortcuts

When the user types one of these shortcuts, call the matching tool directly:

| Shortcut | Tool |
|----------|------|
| `tm:context` | `context_get` |
| `tm:tree` | `thread_list` |
| `tm:create <title>` | `thread_create` |
| `tm:switch <id>` | `thread_switch` |
| `tm:summary [content]` | `summary_update` (write the summary yourself when no content is given) |
| `tm:delete <id>` | `thread_delete` |
| `tm:rebase <id> <new-parent-id>` | `thread_rebase` |
| `tm:merge` | `thread_merge` (write the parent's new summary, including this thread's conclusions) |
| `tm:done [reason]` | `thread_status` with status `done` |
| `tm:abandon <reason>` | `thread_status` with status `abandoned` |
| `tm:stats` | `stats_show` |
| `tm:project <title>` | `project_create` |
| `tm:projects` | `project_list` |
| `tm:init` | `threadmind_init` |
| `tm:help` | List these shortcuts |

## Output

- After `thread_list`, `thread_create`, `thread_status`, `thread_merge` and `stats_show`, show the tool's result as it is: it is already formatted.
- After `summary_update`, confirm in one line what was recorded and in which thread.

## Don't

- Don't edit the files in `.threadmind/` yourself: the tools handle locking, ownership and the tree.
- Don't call `threadmind_hook`: only Claude Code's hooks use it.
- Don't create a project, or delete a thread, without the user asking for it.
