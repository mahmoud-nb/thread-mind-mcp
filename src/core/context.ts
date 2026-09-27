import type {
  StorageService,
  ContextService,
  ContextResult,
  ProjectStats,
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

/**
 * Render an assembled context identically for tools, prompts and resources.
 * Project stats, when given, add the estimated raw history to the footer.
 */
export function formatContext(
  result: ContextResult,
  stats?: ProjectStats
): string {
  let footer = `_ThreadMind context: ~${result.tokens} tokens | depth: ${result.threadDepth} threads_`;

  if (stats) {
    const threads = Object.values(stats.threads);
    const totalCumulativeChars = threads.reduce(
      (sum, s) => sum + s.cumulativeInputLength,
      0
    );
    const totalUpdates = threads.reduce((sum, s) => sum + s.updateCount, 0);

    if (totalCumulativeChars > 0) {
      const estimatedRawTokens = estimateTokensFromLength(totalCumulativeChars);
      const reduction = Math.round(
        (1 - result.tokens / estimatedRawTokens) * 100
      );
      footer += `\n_Estimated raw history: ~${estimatedRawTokens.toLocaleString()} tokens (~${reduction}% reduction from ${totalUpdates} summary updates)_`;
    }
  }

  const body =
    result.text ||
    "(No summaries yet. Use summary_update to record decisions for this thread.)";
  return `${body}\n\n---\n${footer}`;
}

export class ContextServiceImpl implements ContextService {
  constructor(private storage: StorageService) {}

  async assemble(projectId: string, threadId: string): Promise<ContextResult> {
    const project = await this.storage.readProjectConfig(projectId);
    const tree = await this.storage.readTree(projectId);

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

    // Build context
    const sections: string[] = [];

    if (project.systemContext) {
      sections.push(`## System Context\n\n${project.systemContext}`);
    }

    for (let i = 0; i < chain.length; i++) {
      const node = await this.storage.readThread(projectId, chain[i]);
      const isActive = i === chain.length - 1;
      const marker = isActive ? " (active)" : "";

      if (node.content) {
        sections.push(
          `## Thread: ${node.metadata.title}${marker}\n\n${node.content}`
        );
      }
    }

    const text = sections.join("\n\n---\n\n");
    const tokens = estimateTokens(text);

    return { text, tokens, threadDepth: chain.length };
  }
}
