# Team Mode

Team mode enables collaborative thread trees shared across developers via git.

## Overview

In team mode:
- Thread files and tree structures are **committed to git** and shared
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
# Select the shared project: project_switch(projectId: "our-app")
# Your author ID is created on your first write
```

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

### Daily Development

```bash
# Start of day: pull latest threads
git pull

# View the full team tree
# → thread_list

main
├── auth (sarah-7b2c)
│   └── auth-tests (sarah-7b2c)
├── api-routes (mahmoud-a3f9)
│   └── api-validation (mahmoud-a3f9)
└── frontend (alex-1e5f)
```

### Branching from a Teammate

```
You: Create a thread "API Documentation" under "api-routes"

AI:  ✓ Thread "api-documentation" created under "api-routes".
     Author: sarah-7b2c (you)
```

Now you own `api-documentation` and can update its summary, even though its parent `api-routes` belongs to another teammate.

### Sharing Your Work

```bash
git add .threadmind/
git commit -m "Add API documentation thread"
git push
```

## Git Merge Behavior

### What merges cleanly

- **Different thread files** — each thread is a separate `.md` file, so two people creating different threads never conflict
- **New threads** — adding threads only appends to the tree structure

### What may conflict

- **tree.json** — if two people create threads under the same parent simultaneously, the tree index may conflict. Resolution: accept both changes (both new children should appear)

::: tip
If tree conflicts become frequent, you can regenerate the tree from the frontmatter in thread files. The tree is a denormalized index — the source of truth is the thread files themselves.
:::

## Best Practices

1. **Claim topics by creating threads** — create a thread before diving deep into a topic to signal to teammates what you're working on
2. **Summarize regularly** — teammates benefit from your summaries even if they don't read your code
3. **Branch, don't modify** — if you disagree with a teammate's approach, create a child thread with your alternative instead of asking them to change their summary
4. **Pull before creating threads** — avoid duplicate work by seeing what threads already exist
