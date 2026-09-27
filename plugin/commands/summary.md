---
description: Save the summary of the active ThreadMind thread
argument-hint: [what to record]
---

Update the summary of the active ThreadMind thread with the ThreadMind `summary_update` tool.

- If the user gave text ("$ARGUMENTS" is not empty), record it in the fitting section (decisions, constraints, state, open-questions or next-steps) with the `section` parameter.
- Otherwise, write the whole summary from this conversation with these sections, leaving out the empty ones: `## Decisions`, `## Constraints`, `## State`, `## Open questions`, `## Next steps`. Keep what is still true from the current summary, and pass `paths` with the files or directories this thread is about.
