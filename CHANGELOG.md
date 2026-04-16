# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-15

### Added

- **MCP Prompts**: `start-thread` (inject context at session start) and `summarize-thread` (guided summary generation)
- **Token estimation**: `context_get` now reports approximate token count and thread depth
- **Multi-client instructions**: `threadmind_init` tool generates CLAUDE.md, .cursorrules, and generic instruction files
- **Resource notifications**: `notifications/resources/updated` sent after every mutation tool
- **Documentation site**: VitePress-based docs with English and French translations, deployed via GitHub Pages

### Changed

- `context_get` output now includes footer: `ThreadMind context: ~{tokens} tokens | depth: {n} threads`
- `thread_switch` confirmation now shows token count preview
- `project_create` now suggests running `threadmind_init` after creation

### Improved

- Additional test coverage: circular reference detection, MAX_DEPTH limit, token estimation, instruction generation

## [0.1.0] - 2026-04-15

### Added

- Initial release
- Project management: `project_create`, `project_list`, `project_switch`
- Thread management: `thread_create`, `thread_switch`, `thread_list`, `thread_delete`
- Summary management: `summary_update`
- Context assembly: `context_get` tool and `threadmind://context` resource
- Thread tree visualization: `threadmind://tree` resource
- File-based storage in `.threadmind/` directory (git-friendly)
- Solo and team modes with author-based ownership
- Automatic author ID generation from git config
