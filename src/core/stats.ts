import { estimateTokens } from "./context.js";
import { nowIso } from "./clock.js";
import type {
  StorageService,
  StatsService,
  SessionMeasurement,
  ThreadNode,
} from "../types/index.js";

/** Measurements kept in the local config, most recent last. */
const MAX_SESSIONS = 50;

export class StatsServiceImpl implements StatsService {
  constructor(private storage: StorageService) {}

  async recordSessionStart(opts: {
    sessionId: string;
    projectId: string;
    source: string;
    injectedTokens: number;
  }): Promise<void> {
    await this.upsert(opts.sessionId, {
      projectId: opts.projectId,
      startedAt: nowIso(),
      source: opts.source,
      injectedTokens: opts.injectedTokens,
    });
  }

  async recordSessionEnd(opts: {
    sessionId: string;
    reason: string;
    finalContextTokens: number | null;
  }): Promise<void> {
    await this.upsert(opts.sessionId, {
      endedAt: nowIso(),
      endReason: opts.reason,
      ...(opts.finalContextTokens !== null
        ? { finalContextTokens: opts.finalContextTokens }
        : {}),
    });
  }

  async sessions(): Promise<SessionMeasurement[]> {
    return (await this.storage.readConfig()).sessions ?? [];
  }

  private async upsert(
    sessionId: string,
    fields: Partial<SessionMeasurement>
  ): Promise<void> {
    await this.storage.withLock(async () => {
      const state = await this.storage.readConfig();
      const sessions = [...(state.sessions ?? [])];
      const index = sessions.findIndex((s) => s.sessionId === sessionId);
      if (index === -1) {
        sessions.push({ sessionId, ...fields });
      } else {
        sessions[index] = { ...sessions[index], ...fields };
      }
      await this.storage.writeConfig({
        ...state,
        sessions: sessions.slice(-MAX_SESSIONS),
      });
    });
  }
}

export function formatStatsReport(opts: {
  projectTitle: string;
  threads: ThreadNode[];
  activeThreadId: string;
  context: { tokens: number; threadDepth: number };
  sessions: SessionMeasurement[];
}): string {
  const { projectTitle, threads, activeThreadId, context, sessions } = opts;

  const count = (status?: string) =>
    threads.filter((t) => t.metadata.status === status).length;
  const statusParts = [
    `${count(undefined)} active`,
    count("done") > 0 ? `${count("done")} done` : null,
    count("abandoned") > 0 ? `${count("abandoned")} abandoned` : null,
  ].filter(Boolean);

  let output = `ThreadMind Stats: "${projectTitle}"\n\n`;
  output += `Threads: ${threads.length} (${statusParts.join(", ")})\n`;
  output += `Active thread: ${activeThreadId} (depth ${context.threadDepth}, ~${context.tokens.toLocaleString("en-US")} tokens of context)\n\n`;

  output += `Summaries:\n`;
  output += `  ${"Thread".padEnd(24)} ${"Tokens".padEnd(8)} Updated\n`;
  const ordered = [...threads].sort((a, b) =>
    a.metadata.createdAt.localeCompare(b.metadata.createdAt)
  );
  for (const { metadata, content } of ordered) {
    const tokens = `~${estimateTokens(content)}`;
    output += `  ${metadata.id.padEnd(24)} ${tokens.padEnd(8)} ${metadata.updatedAt.slice(0, 10)}\n`;
  }

  const ended = sessions.filter((s) => s.finalContextTokens !== undefined);
  const started = sessions.filter((s) => s.injectedTokens !== undefined);
  output += `\nMeasured sessions (Claude Code plugin):\n`;
  if (ended.length === 0 && started.length === 0) {
    output += `  None yet. With the ThreadMind plugin for Claude Code, each session records the size of the conversation when it ends and the context loaded when the next one starts.\n`;
  } else {
    if (ended.length > 0) {
      const sizes = ended.map((s) => s.finalContextTokens!);
      output += `  Conversation size when sessions ended: ~${formatTokens(average(sizes))} tokens on average, ~${formatTokens(Math.max(...sizes))} at most (${plural(ended.length, "session")})\n`;
    }
    if (started.length > 0) {
      const injected = started.map((s) => s.injectedTokens!);
      output += `  ThreadMind context loaded at session start: ~${formatTokens(average(injected))} tokens on average (${plural(started.length, "session")})\n`;
    }
  }

  output += `\nSummary and context sizes are estimates (~3.5 characters per token); conversation sizes come from the Claude Code transcripts.`;
  return output;
}

function average(values: number[]): number {
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function formatTokens(value: number): string {
  return value.toLocaleString("en-US");
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
