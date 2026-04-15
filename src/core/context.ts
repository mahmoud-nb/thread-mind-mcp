import type {
  StorageService,
  ContextService,
  ContextResult,
} from "../types/index.js";

const MAX_DEPTH = 50;

/**
 * Estimate token count from text.
 * Approximation: 1 token ≈ 4 characters for English, ~3.5 for mixed content.
 * This is intentionally conservative (slightly over-estimates).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
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
