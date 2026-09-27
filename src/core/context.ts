import { buildTree } from "./storage.js";
import { inheritedSummary } from "./summary.js";
import { commitsSince, headCommit } from "./git.js";
import type {
  StorageService,
  ContextService,
  ContextResult,
  ThreadMetadata,
} from "../types/index.js";

const MAX_DEPTH = 50;

/**
 * Estimate token count from text.
 * Approximation: 1 token ≈ 4 characters for English, ~3.5 for mixed content.
 * This is intentionally conservative (slightly over-estimates).
 */
export function estimateTokens(text: string): number {
  return estimateTokensFromLength(text.length);
}

export function estimateTokensFromLength(length: number): number {
  return Math.ceil(length / 3.5);
}

/** Render an assembled context identically for tools, prompts, resources and hooks. */
export function formatContext(result: ContextResult): string {
  let footer = `_ThreadMind context: ~${result.tokens} tokens | depth: ${result.threadDepth} threads_`;
  if (result.omitted.length > 0) {
    footer += `\n_Left out to fit the token budget: ${result.omitted.join(", ")} (readable as threadmind://thread/{id} resources)_`;
  }
  if (result.truncated) {
    footer += `\n_Cut to fit the token budget._`;
  }

  const body =
    result.text ||
    "(No summaries yet. Use summary_update to record decisions for this thread.)";
  return `${body}\n\n---\n${footer}`;
}

interface Section {
  threadId: string;
  text: string;
}

export class ContextServiceImpl implements ContextService {
  constructor(private storage: StorageService) {}

  async assemble(
    projectId: string,
    threadId: string,
    opts: { maxTokens?: number } = {}
  ): Promise<ContextResult> {
    const project = await this.storage.readProjectConfig(projectId);
    const threads = await this.storage.listThreads(projectId);
    const tree = buildTree(threads);
    const byId = new Map(threads.map((t) => [t.metadata.id, t]));
    if (!byId.has(threadId)) {
      throw new Error(`Thread "${threadId}" not found`);
    }

    // Walk from active thread up to root
    const chain: string[] = [];
    const visited = new Set<string>();
    let current: string | null = threadId;

    while (current && chain.length < MAX_DEPTH) {
      if (visited.has(current)) {
        throw new Error(`Circular reference detected at thread "${current}"`);
      }
      visited.add(current);
      chain.push(current);
      current = tree.nodes[current]?.parentId ?? null;
    }

    // Reverse: root → ... → active
    chain.reverse();

    // Staleness checks need git: skip them where it doesn't answer
    const root = await this.storage.workspaceRoot();
    const canCheck =
      chain.some((id) => byId.get(id)!.metadata.commit) &&
      (await headCommit(root)) !== null;
    const notes = await Promise.all(
      chain.map((id) =>
        canCheck ? stalenessNote(root, byId.get(id)!.metadata) : null
      )
    );

    const sections: Section[] = [];
    chain.forEach((id, i) => {
      const { metadata, content } = byId.get(id)!;
      const isActive = i === chain.length - 1;
      // Ancestors only pass on the durable part of their summary
      const body = isActive ? content : inheritedSummary(content);
      if (!body) return;

      const status = metadata.status ? ` [${metadata.status}]` : "";
      const marker = isActive ? " (active)" : "";
      const note = notes[i] ? `${notes[i]}\n\n` : "";
      sections.push({
        threadId: id,
        text: `## Thread: ${metadata.title}${status}${marker}\n\n${note}${body}`,
      });
    });

    const system = project.systemContext
      ? `## System Context\n\n${project.systemContext}`
      : null;
    const render = () =>
      [system, ...sections.map((s) => s.text)]
        .filter((part): part is string => part !== null)
        .join("\n\n---\n\n");

    let text = render();
    const omitted: string[] = [];
    let truncated = false;

    if (opts.maxTokens !== undefined) {
      // Leave out the farthest ancestors first; the active thread stays
      while (
        estimateTokens(text) > opts.maxTokens &&
        sections.length > 1
      ) {
        omitted.push(sections.shift()!.threadId);
        text = render();
      }
      const maxLength = Math.floor(opts.maxTokens * 3.5);
      if (text.length > maxLength) {
        text = `${text.slice(0, Math.max(0, maxLength - 3))}…`;
        truncated = true;
      }
    }

    return {
      text,
      tokens: estimateTokens(text),
      threadDepth: chain.length,
      omitted,
      truncated,
    };
  }
}

/**
 * A warning for summaries that code changes may have made outdated, based on
 * the commit recorded when the summary was written.
 */
async function stalenessNote(
  root: string,
  metadata: ThreadMetadata
): Promise<string | null> {
  if (!metadata.commit) return null;

  const paths = metadata.paths ?? [];
  const count = await commitsSince(root, metadata.commit, paths);
  if (count === null) {
    return `_⚠ Written on commit ${metadata.commit.slice(0, 7)}, which is not in this repository's history: check this summary is still accurate._`;
  }
  if (count === 0) return null;

  const commits = count === 1 ? "1 commit" : `${count} commits`;
  return paths.length > 0
    ? `_⚠ ${commits} changed ${paths.join(", ")} since this summary was written: check it is still accurate._`
    : `_Written ${commits} ago._`;
}
