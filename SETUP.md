# Development & Publishing

How to work on ThreadMind and release it. For using ThreadMind, see the [README](README.md) and the [documentation](https://mahmoud-nb.github.io/thread-mind-mcp/).

## Development

### Setup

```bash
git clone https://github.com/mahmoud-nb/thread-mind-mcp.git
cd thread-mind-mcp
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
```

### Local development

```bash
npm run dev           # Watches src/ and restarts on changes
```

### Type checking

```bash
npm run lint          # TypeScript type check without emitting
```

### Hooks

The Claude Code hooks are subcommands of the same binary; they read the hook input on stdin:

```bash
echo '{"session_id":"test","cwd":"'$PWD'","source":"startup"}' | node dist/index.js hook session-start
```

### Documentation

```bash
npm run docs:dev      # Local preview of the VitePress site
npm run docs:build
```

The site is deployed to GitHub Pages by `.github/workflows/deploy-docs.yml` on every push to `master`.

---

## Publishing

### Prerequisites

1. Log in to npm:
   ```bash
   npm login
   ```

2. Make sure the previous release is tagged: the changelog is generated from the commits since the last version tag.
   ```bash
   git tag
   ```

### Release

```bash
# Patch release (0.1.0 → 0.1.1) — bug fixes
npm run release:patch

# Minor release (0.1.0 → 0.2.0) — new features
npm run release:minor

# Major release (0.1.0 → 1.0.0) — breaking changes
npm run release:major
```

These commands:
1. Bump the version in `package.json`, update `CHANGELOG.md` from the commits, commit and tag
2. Run the tests and build the project
3. Publish to npm
4. Run `npm run plugin:sync`: point the Claude Code plugin and `server.json` at the new version, regenerate `plugin/package-lock.json` and commit

Then push with the tags:

```bash
git push origin master --follow-tags
```

`plugin/package-lock.json` is what makes Claude Code install the server inside the plugin: check it exists and names the new version before pushing. If `plugin:sync` fails because npm doesn't serve the new version yet, run `npm run plugin:sync` again a minute later.

> [!WARNING]
> Claude Code installs the plugin from the files on `master`, with the server version that `plugin/package.json` names. Plugin files that rely on a new server feature (a hook calling a new tool, a new environment variable) must not reach `master` before that server version is on npm: merge them into `master` and push only after `npm run release:*` has run.

---

## Publishing to the MCP Registry

The [MCP Registry](https://registry.modelcontextprotocol.io) lists MCP servers; it hosts only their metadata (`server.json`) and points to the npm package. Publish to it **after** the npm release, once per version: a published version can't be replaced.

What the registry checks:
- `server.json` → `name` (`io.github.mahmoud-nb/thread-mind`) equals `mcpName` in the **published** `package.json`
- `server.json` → `packages[0].version` exists on npm
- With GitHub login, the name must start with `io.github.<your GitHub username>/`

`npm run plugin:sync` already sets the versions in `server.json`.

### Windows, step by step (PowerShell)

**1. Check the release is on npm** (from the repository root):

```powershell
npm view thread-mind-mcp version mcpName
Get-Content server.json | Select-String '"version"'
```

The npm version and both versions in `server.json` must match, and `mcpName` must print `io.github.mahmoud-nb/thread-mind`.

**2. Install `mcp-publisher`** (once). Download it into a tools folder outside the repository:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\tools" | Out-Null
Set-Location "$env:USERPROFILE\tools"
$arch = if ([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture -eq "Arm64") { "arm64" } else { "amd64" }
Invoke-WebRequest -Uri "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_windows_$arch.tar.gz" -OutFile "mcp-publisher.tar.gz"
tar xf mcp-publisher.tar.gz mcp-publisher.exe
Remove-Item mcp-publisher.tar.gz
```

Add that folder to your user `PATH` (once), then open a **new** terminal:

```powershell
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$userPath;$env:USERPROFILE\tools", "User")
```

Check it runs:

```powershell
mcp-publisher --help
```

If Windows SmartScreen blocks the executable, right-click it → **Properties** → **Unblock**.

**3. Log in with GitHub**, from the repository root:

```powershell
Set-Location C:\path\to\thread-mind-mcp
mcp-publisher login github
```

It prints a code: open <https://github.com/login/device>, sign in as **mahmoud-nb**, enter the code and authorize. The terminal then shows `Successfully logged in`. The login is kept for later releases until the token expires.

**4. Publish** (it reads `server.json` in the current folder):

```powershell
mcp-publisher publish
```

Expected output: `✓ Successfully published` then `✓ Server io.github.mahmoud-nb/thread-mind version 0.5.0`.

**5. Verify:**

```powershell
Invoke-RestMethod "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.mahmoud-nb/thread-mind" | ConvertTo-Json -Depth 6
```

### For later releases

After `npm run release:*` and `git push`, run only:

```powershell
mcp-publisher publish
```

If it answers `Invalid or expired Registry JWT token`, run `mcp-publisher login github` again.

### Troubleshooting

| Error | Fix |
|-------|-----|
| `Registry validation failed for package` | The published npm package lacks `mcpName`, or it differs from `name` in `server.json`: publish a new npm version with the right `mcpName` |
| `You do not have permission to publish this server` | You're logged in with another GitHub account: the name must start with `io.github.<that account>/` |
| `Invalid or expired Registry JWT token` | `mcp-publisher login github` |
| Version already exists | A version can't be republished: bump the version (npm release), then publish again |
| `mcp-publisher` is not recognized | Open a new terminal after changing `PATH`, or run `$env:USERPROFILE\tools\mcp-publisher.exe` |

## Publishing the skill on Agensi

[Agensi](https://www.agensi.io) is a marketplace of agent skills: it lists skills in the SKILL.md format, not MCP servers. ThreadMind is published there as the `thread-mind` skill, in [`skills/thread-mind/`](skills/thread-mind/), which teaches agents to use the server and shows how to set it up.

1. Build the archive:

   ```bash
   npm run skill:pack
   ```

   This writes `skills/dist/thread-mind.zip`: a single `thread-mind/` folder with `SKILL.md` at its root, text files only, as Agensi requires.
2. On Agensi, create an account and connect Stripe from the creator dashboard: Agensi asks for it even for free skills.
3. In the dashboard, choose **Submit a Skill**, upload the archive, then fill in the listing with the texts of [`skills/agensi-listing.md`](skills/agensi-listing.md).
4. Agensi runs a security scan, an AI review and a human check, usually within 24 to 48 hours. If the scan raises a question, the listing file has notes for the reviewers.

To update the skill, change `skills/thread-mind/`, run `npm run skill:pack` again and upload the new archive. Keep the skill in step with the server: the tests check that it teaches every shortcut and documents every tool.
