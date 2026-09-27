import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StorageServiceImpl } from "../../src/core/storage.js";
import { StatsServiceImpl, formatStatsReport } from "../../src/core/stats.js";
import type { ThreadNode } from "../../src/types/index.js";

describe("StatsService", () => {
  let basePath: string;
  let storage: StorageServiceImpl;
  let stats: StatsServiceImpl;

  beforeEach(async () => {
    basePath = await mkdtemp(join(tmpdir(), "tm-stats-"));
    storage = new StorageServiceImpl(basePath);
    stats = new StatsServiceImpl(storage);
  });

  afterEach(async () => {
    await rm(basePath, { recursive: true, force: true });
  });

  it("records the start and the end of a session together", async () => {
    await stats.recordSessionStart({
      sessionId: "s1",
      projectId: "proj",
      source: "clear",
      injectedTokens: 1200,
    });
    await stats.recordSessionEnd({
      sessionId: "s1",
      reason: "clear",
      finalContextTokens: 48000,
    });

    const [session] = await stats.sessions();
    expect(session).toMatchObject({
      sessionId: "s1",
      projectId: "proj",
      source: "clear",
      injectedTokens: 1200,
      endReason: "clear",
      finalContextTokens: 48000,
    });
    expect(session.startedAt).toBeTruthy();
    expect(session.endedAt).toBeTruthy();
  });

  it("keeps the 50 most recent sessions", async () => {
    for (let i = 0; i < 55; i++) {
      await stats.recordSessionEnd({
        sessionId: `s${i}`,
        reason: "other",
        finalContextTokens: i,
      });
    }

    const sessions = await stats.sessions();
    expect(sessions).toHaveLength(50);
    expect(sessions[0].sessionId).toBe("s5");
    expect(sessions[49].sessionId).toBe("s54");
  });

  it("leaves out an unknown conversation size", async () => {
    await stats.recordSessionEnd({
      sessionId: "s1",
      reason: "logout",
      finalContextTokens: null,
    });

    const [session] = await stats.sessions();
    expect(session.finalContextTokens).toBeUndefined();
  });
});

describe("formatStatsReport", () => {
  const thread = (id: string, content: string, status?: "done" | "abandoned"): ThreadNode => ({
    metadata: {
      id,
      title: id,
      parentId: id === "main" ? null : "main",
      author: "a",
      createdAt: `2026-01-0${id === "main" ? 1 : 2}T00:00:00.000Z`,
      updatedAt: "2026-09-20T10:00:00.000Z",
      ...(status ? { status } : {}),
    },
    content,
  });

  const threads = [
    thread("main", "x".repeat(350)),
    thread("auth", "y".repeat(70)),
    thread("graphql", "", "abandoned"),
  ];

  it("reports threads, summary sizes and measured sessions", () => {
    const report = formatStatsReport({
      projectTitle: "Shop",
      threads,
      activeThreadId: "auth",
      context: { tokens: 130, threadDepth: 2 },
      sessions: [
        { sessionId: "a", injectedTokens: 1000, finalContextTokens: 40000 },
        { sessionId: "b", injectedTokens: 1300, finalContextTokens: 60000 },
      ],
    });

    expect(report).toContain('ThreadMind Stats: "Shop"');
    expect(report).toContain("Threads: 3 (2 active, 1 abandoned)");
    expect(report).toContain("Active thread: auth (depth 2, ~130 tokens of context)");
    expect(report).toMatch(/main\s+~100\s+2026-09-20/);
    expect(report).toContain(
      "Conversation size when sessions ended: ~50,000 tokens on average, ~60,000 at most (2 sessions)"
    );
    expect(report).toContain(
      "ThreadMind context loaded at session start: ~1,150 tokens on average (2 sessions)"
    );
    expect(report).not.toContain("reduction");
  });

  it("explains how to get measurements", () => {
    const report = formatStatsReport({
      projectTitle: "Shop",
      threads,
      activeThreadId: "main",
      context: { tokens: 100, threadDepth: 1 },
      sessions: [],
    });

    expect(report).toContain("None yet. With the ThreadMind plugin for Claude Code");
  });
});
