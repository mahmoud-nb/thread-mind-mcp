import { formatContext } from "../core/context.js";
import type { ActiveThread, Services } from "../types/index.js";

/**
 * Claude Code caps the text a hook adds to the conversation: a longer text is
 * replaced by a file path and a short preview.
 */
export const HOOK_TEXT_LIMIT = 10_000;

/** Room kept for the context's footer and the note about shortened context. */
const FOOTER_ROOM = 600;

/**
 * The active thread's context, introduced for Claude and sized to fit in a
 * hook's output, followed by the given notes.
 */
export async function sessionContext(
  services: Services,
  active: ActiveThread,
  notes: string[] = []
): Promise<string> {
  const project = await services.project.get(active.projectId);
  const intro = `ThreadMind context for this session — project "${project.title}", active thread "${active.threadId}"${origin(active)}.`;
  const extra = notes.length > 0 ? `\n${notes.join("\n")}` : "";

  let budget = HOOK_TEXT_LIMIT - intro.length - extra.length - FOOTER_ROOM;
  for (;;) {
    const result = await services.context.assemble(
      active.projectId,
      active.threadId,
      { maxTokens: Math.max(1, Math.floor(budget / 3.5)) }
    );
    const shortened = result.omitted.length > 0 || result.truncated;
    const loaded = shortened
      ? " It was shortened to fit: call context_get if you need the parts left out."
      : " It is already loaded: no need to call context_get.";
    const text = `${intro}${loaded}${extra}\n\n${formatContext(result)}`;
    // A long list of left-out ancestors can still overflow: shrink and retry
    if (text.length <= HOOK_TEXT_LIMIT || budget <= 1_000) return text;
    budget -= text.length - HOOK_TEXT_LIMIT + 100;
  }
}

function origin(active: ActiveThread): string {
  switch (active.reason) {
    case "branch":
      return `, linked to git branch "${active.branch}"`;
    case "branch-memory":
      return `, last used on git branch "${active.branch}"`;
    case "last-used":
      return ", last used";
    default:
      return "";
  }
}
