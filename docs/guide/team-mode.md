# Team Mode

Team mode enables collaborative thread trees shared across developers via git.

## Overview

In team mode:
- Thread files are **committed to git** and shared (each file records its parent: there is no separate tree index)
- Each team member has a **unique author ID** stored locally
- Ownership rules control who can modify which threads
- Members can always **branch from any thread** to build on each other's work

## Setting Up Team Mode

### 1. Create a team project

```
project_create(title: "Our App", mode: "team")
```

### 2. Commit the `.threadmind/` directory

```bash
git add .threadmind/
git commit -m "Initialize ThreadMind project"
git push
```

### 3. Teammates pull and start working

```bash
git pull
# A single project is selected automatically (otherwise: project_switch)
# Your author ID is created on your first write
```

A teammate who checks out one of your feature branches starts on the thread linked to it (see [Git Branches](/guide/threads#git-branches)).

## Author Identity

On your first write (creating a thread, updating a summary…), ThreadMind derives your author ID from your git identity:

```
{git_user_name}-{4 hex chars derived from git user.email}
```

Examples:
- `mahmoud-a3f9`
- `sarah-7b2c`
- `dev-e4d1`

Because it comes from `git config user.email`, you get the same ID on every clone and machine, and keep ownership of your threads after a fresh clone. Without a git email, a random suffix is used. To choose the ID explicitly, set `THREADMIND_AUTHOR` in the `env` of the MCP server configuration.

This ID is stored in `.threadmind/config.json`, which is **gitignored** — each team member has their own local identity.

## Ownership Rules

| Action | Own Threads | Teammates' Threads |
|--------|:-----------:|:------------------:|
| View summary | Yes | Yes |
| Update summary | Yes | No |
| Delete thread | Yes | No |
| Create child thread | Yes | Yes |
| Switch to | Yes | Yes |

The key principle: **you can always read and branch from anyone's work, but only modify your own**.

Deleting a thread also deletes its descendants, so the deletion is refused if any descendant belongs to a teammate.

::: warning
Ownership prevents accidental edits; it is not access control. Anyone with write access to the repository can edit the files directly or set `THREADMIND_AUTHOR`.
:::

## Workflow

### Work on a feature branch

```bash
git pull
git switch -c feature/api-docs
```

```
You: Create a thread "API Documentation" under "api-routes"

AI:  ✓ Thread "api-documentation" created under "api-routes".
     Linked to git branch "feature/api-docs": it becomes the active thread whenever this branch is checked out.

     main
     ├── auth
     │   └── auth-tests
     ├── api-routes [branch: feature/api-routes]
     │   └── api-documentation [branch: feature/api-docs] ← active
     └── frontend
```

You own `api-documentation` and can update its summary, even though its parent `api-routes` belongs to another teammate. A thread's author, status and branch are shown by its `threadmind://thread/{id}` resource.

### Share it with the code

Commit the thread files with the code they describe, so they are reviewed in the same pull request:

```bash
git add .threadmind/ src/
git commit -m "docs(api): document the routes"
git push -u origin feature/api-docs
```

A teammate who checks out `feature/api-docs` starts their next session on `api-documentation`. Once the branch is merged, fold the thread into its parent with `thread_merge`, or close it with `thread_status`.

## Git Merge Behavior

### What merges cleanly

- **Different thread files** — each thread is a separate `.md` file that records its own parent, so two people creating threads never conflict, even under the same parent
- **Session state and measurements** — they live in `.threadmind/config.json`, which is not committed

### What may conflict

- **The same thread file** — only if two people edit the same thread, which ownership rules prevent through ThreadMind

::: warning Upgrading from 0.4
Earlier versions kept the tree in `.threadmind/trees/<project>.json` and statistics in `.threadmind/stats/`. ThreadMind now migrates the tree into the thread files on first use and deletes `trees/<project>.json`; commit that change. Upgrade the whole team together: older versions need the tree file. The `stats/` directory is no longer used and can be deleted.
:::

## Best Practices

1. **Claim topics by creating threads** — create a thread before diving deep into a topic to signal to teammates what you're working on
2. **Summarize regularly** — teammates benefit from your summaries even if they don't read your code
3. **Branch, don't modify** — if you disagree with a teammate's approach, create a child thread with your alternative instead of asking them to change their summary
4. **Pull before creating threads** — avoid duplicate work by seeing what threads already exist
