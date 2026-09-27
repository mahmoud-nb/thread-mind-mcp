import { estimateTokensFromLength } from "./context.js";
import type {
  StorageService,
  StatsService,
  ProjectStats,
  ContextResult,
} from "../types/index.js";

export function formatStatsReport(opts: {
  projectTitle: string;
  stats: ProjectStats;
  threadCount: number;
  context: ContextResult;
}): string {
  const { projectTitle, stats, threadCount, context } = opts;
  const threads = Object.entries(stats.threads);

  const totalUpdates = threads.reduce((sum, [, s]) => sum + s.updateCount, 0);
  const totalCumulativeChars = threads.reduce(
    (sum, [, s]) => sum + s.cumulativeInputLength,
    0
  );
  const estimatedRawTokens = estimateTokensFromLength(totalCumulativeChars);
  const reduction =
    estimatedRawTokens > 0
      ? Math.round((1 - context.tokens / estimatedRawTokens) * 100)
      : 0;

  // Build per-thread breakdown
  const perThreadLines: string[] = [];
  for (const [threadId, threadStats] of threads) {
    const currentTk = estimateTokensFromLength(threadStats.currentContentLength);
    const cumulativeTk = estimateTokensFromLength(
      threadStats.cumulativeInputLength
    );
    const ratio =
      cumulativeTk > 0 ? Math.round((1 - currentTk / cumulativeTk) * 100) : 0;
    perThreadLines.push(
      `  ${threadId.padEnd(20)} ${String(threadStats.updateCount).padEnd(9)} ~${String(currentTk).padEnd(9)} ~${String(cumulativeTk).padEnd(13)} ${ratio}%`
    );
  }

  let output = `ThreadMind Stats: "${projectTitle}"\n\n`;
  output += `Overview:\n`;
  output += `  Threads: ${threadCount} (${threads.length} with tracked updates)\n`;
  output += `  Summary updates: ${totalUpdates}\n`;
  output += `  Current context: ~${context.tokens} tokens (depth: ${context.threadDepth})\n\n`;

  if (estimatedRawTokens > 0) {
    output += `Token Savings (estimated):\n`;
    output += `  Estimated raw history: ~${estimatedRawTokens.toLocaleString()} tokens\n`;
    output += `  ThreadMind context:    ~${context.tokens} tokens\n`;
    output += `  Reduction:             ~${reduction}%\n\n`;
  } else {
    output += `Token Savings:\n`;
    output += `  No summary updates tracked yet. Use summary_update to start tracking.\n\n`;
  }

  if (perThreadLines.length > 0) {
    output += `Per-Thread Breakdown:\n`;
    output += `  ${"Thread".padEnd(20)} ${"Updates".padEnd(9)} ${"Current".padEnd(10)} ${"Cumulative".padEnd(14)} Ratio\n`;
    output += perThreadLines.join("\n") + "\n\n";
  }

  output += `Method: Cumulative summary input vs current context size.\n`;
  output += `Token estimates use ~3.5 chars/token approximation.`;
  return output;
}

export class StatsServiceImpl implements StatsService {
  constructor(private storage: StorageService) {}

  async recordUpdate(
    projectId: string,
    threadId: string,
    newContent: string
  ): Promise<void> {
    await this.storage.withLock(async () => {
      const stats = await this.storage.readProjectStats(projectId);
      const existing = stats.threads[threadId];

      if (existing) {
        existing.updateCount += 1;
        existing.currentContentLength = newContent.length;
        existing.cumulativeInputLength += newContent.length;
        existing.lastUpdatedAt = new Date().toISOString();
      } else {
        stats.threads[threadId] = {
          updateCount: 1,
          firstContentLength: newContent.length,
          currentContentLength: newContent.length,
          cumulativeInputLength: newContent.length,
          lastUpdatedAt: new Date().toISOString(),
        };
      }

      await this.storage.writeProjectStats(projectId, stats);
    });
  }

  async getProjectStats(projectId: string): Promise<ProjectStats> {
    return this.storage.readProjectStats(projectId);
  }
}
