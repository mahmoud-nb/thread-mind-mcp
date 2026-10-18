# Agensi listing: ThreadMind

Texts for the Agensi submission form. Upload `skills/dist/thread-mind.zip` (built with `npm run skill:pack`); this file stays out of the archive.

## Title

ThreadMind: Persistent Project Memory for AI Coding Agents

## Short description

Your agent remembers what was decided, across sessions and agents: a git-friendly tree of thread summaries, loaded when a conversation starts.

## Price

Free. ThreadMind is open source (MIT).

## Category

Develop › Agents & orchestration (alternatives: Productivity, LLM ops)

## Tags

memory, context, mcp, sessions, decisions, git, claude-code, cursor, codex, copilot, gemini-cli, team

## Compatible agents

Claude Code, Cursor, VS Code (GitHub Copilot), GitHub Copilot CLI, Codex CLI, Gemini CLI, Windsurf, and any agent that supports SKILL.md skills and MCP servers.

## Listing description

Long conversations with an AI coding agent end the same way: the context fills up, the conversation gets compacted or cleared, and the decisions made along the way are gone. The next session starts from scratch, or from a summary nobody can review.

**ThreadMind** gives your agent a persistent, structured memory of the project. Work is organized in a tree of **threads**, one per topic. Each thread keeps a short markdown summary in sections: **Decisions**, **Constraints**, **State**, **Open questions**, **Next steps**. When a conversation starts, the agent loads the active thread's summary plus the decisions and constraints of its parent threads: a few hundred tokens instead of the whole history.

This skill teaches your agent to use the ThreadMind MCP server:

- **Load the context** of the work when a conversation starts
- **Save as it goes**: one decision, one constraint, the current state, without rewriting everything
- **One thread per topic**: create, switch, merge finished threads into their parent, mark them done or abandoned with the reason
- **Follows git**: a thread created on a feature branch becomes active whenever that branch is checked out, and summaries get flagged when the files they cover change
- **Shortcuts**: `tm:summary`, `tm:tree`, `tm:context`, `tm:create`, `tm:merge`…

**Built for teams.** Summaries are plain files in `.threadmind/`, committed and reviewed with the code they describe. In team mode, everyone can build on anyone's threads, and only edit their own.

**Works across agents.** The same memory serves Claude Code, Cursor, Codex, Copilot or Gemini CLI: start a topic in one, continue it in another.

**Requirements:** the ThreadMind MCP server (`thread-mind-mcp` on npm, Node.js 18+). The skill includes the configuration for each agent, and tells you when the server is missing. It never installs anything by itself.

**Privacy:** everything stays in your repository. The server makes no network calls, needs no account and no API key.

Open source (MIT): https://github.com/mahmoud-nb/thread-mind-mcp. Documentation: https://mahmoud-nb.github.io/thread-mind-mcp/

## Example prompts

- "Save what we decided about authentication"
- "Resume the work on the payment integration"
- "Start a new thread for the database migration"
- `tm:tree`
- `tm:summary`

## Links

- Documentation: https://mahmoud-nb.github.io/thread-mind-mcp/
- Source code: https://github.com/mahmoud-nb/thread-mind-mcp
- npm: https://www.npmjs.com/package/thread-mind-mcp

## Notes for the review

If the form has a field for reviewers, or if the security scan raises a question:

- The skill contains markdown files only: no scripts, no binaries, no encoded content.
- It relies on an MCP server the user sets up themselves. `references/setup.md` shows the configuration, which runs `npx -y thread-mind-mcp`: the npm package `thread-mind-mcp`, open source (MIT), source on GitHub. The skill tells the agent not to edit configuration files or install anything unless the user asks.
- The server only reads and writes the `.threadmind/` directory of the project, and makes no network calls.
- The skill asks the agent to keep secrets and personal data out of summaries.

## Updates

After a change in `skills/thread-mind/`, run `npm run skill:pack` and upload the new archive in the Agensi dashboard. Buyers' agents get the update automatically.
