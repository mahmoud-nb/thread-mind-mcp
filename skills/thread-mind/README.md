# ThreadMind skill

Persistent, git-friendly memory for AI coding agents. This skill teaches your agent to use the ThreadMind MCP server: load the context of the work when a conversation starts, save decisions and progress as they happen, and organize topics in a tree of threads.

## What it does

- Loads the active thread's context (its summary, plus the decisions and constraints of its parent threads) at the start of a conversation
- Records decisions, constraints, state and next steps in structured summaries, one section at a time
- Creates a thread per topic or sub-task, follows git feature branches, merges finished threads into their parent
- Answers the `tm:` shortcuts: `tm:context`, `tm:summary`, `tm:tree`, `tm:create`, `tm:merge`…

## Requirements

The ThreadMind MCP server, `thread-mind-mcp` on npm (Node.js 18 or later), declared in your agent's MCP configuration. [references/setup.md](references/setup.md) gives the configuration for Claude Code, Cursor, VS Code, GitHub Copilot CLI, Codex, Gemini CLI and Windsurf.

If the server isn't set up, the skill tells you and shows the configuration to add. It never installs anything by itself.

## Usage

Work as usual: the skill activates when you ask to save decisions, resume earlier work or start a new topic. You can also type the shortcuts:

```
tm:project My App          create a project
tm:create Authentication   start a thread for a topic
tm:summary                 save what was decided and done
tm:tree                    show the threads
tm:context                 reload the context in a new conversation
tm:merge                   fold a finished thread into its parent
```

## Configuration

The skill itself has no options. The server's options (`THREADMIND_ROOT` to pin the project directory, `THREADMIND_AUTHOR` for team mode) are environment variables of its MCP configuration.

## Files

| File | Content |
|------|---------|
| `SKILL.md` | The instructions the agent follows |
| `references/setup.md` | Server configuration for each agent |
| `references/summaries.md` | How to write useful summaries |
| `references/tools.md` | The server's tools and their parameters |

## Security and privacy

- The skill contains instructions only: no scripts, no network calls.
- The ThreadMind server stores its data in `.threadmind/` inside your project and makes no network calls. Starting it with `npx` downloads the npm package the first time.
- Summaries are plain markdown files: review them like code, and keep secrets out of them.

## Links

- Documentation: https://mahmoud-nb.github.io/thread-mind-mcp/
- Source code (MIT): https://github.com/mahmoud-nb/thread-mind-mcp
- npm: https://www.npmjs.com/package/thread-mind-mcp
