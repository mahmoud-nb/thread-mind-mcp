---
description: Fold the finished ThreadMind thread into its parent
---

The active ThreadMind thread is finished. Read the parent thread's summary (the `threadmind://thread/{id}` resource or `context_get`), write the parent's new summary so that it includes this thread's conclusions, then call the ThreadMind `thread_merge` tool with it as `parentSummary`.
