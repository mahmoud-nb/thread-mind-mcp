import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StorageServiceImpl } from "../../src/core/storage.js";
import { StatsServiceImpl } from "../../src/core/stats.js";

describe("StatsService", () => {
  let basePath: string;
  let storage: StorageServiceImpl;
  let stats: StatsServiceImpl;

  beforeEach(async () => {
    basePath = await mkdtemp(join(tmpdir(), "tm-stats-"));
    storage = new StorageServiceImpl(basePath);
    await storage.ensureInitialized();
    stats = new StatsServiceImpl(storage);
  });

  afterEach(async () => {
    await rm(basePath, { recursive: true, force: true });
  });

  it("creates stats entry on first recordUpdate", async () => {
    await stats.recordUpdate("proj1", "main", "First summary content here");

    const result = await stats.getProjectStats("proj1");
    expect(result.threads["main"]).toBeDefined();
    expect(result.threads["main"].updateCount).toBe(1);
    expect(result.threads["main"].firstContentLength).toBe(26);
    expect(result.threads["main"].currentContentLength).toBe(26);
    expect(result.threads["main"].cumulativeInputLength).toBe(26);
  });

  it("increments updateCount and accumulates cumulativeInputLength", async () => {
    await stats.recordUpdate("proj1", "main", "Short");
    await stats.recordUpdate("proj1", "main", "A much longer second update");

    const result = await stats.getProjectStats("proj1");
    const s = result.threads["main"];
    expect(s.updateCount).toBe(2);
    expect(s.firstContentLength).toBe(5); // "Short"
    expect(s.currentContentLength).toBe(27); // "A much longer second update"
    expect(s.cumulativeInputLength).toBe(5 + 27); // both accumulated
  });

  it("currentContentLength reflects only the latest update", async () => {
    await stats.recordUpdate("proj1", "main", "AAAAAAAAAA"); // 10 chars
    await stats.recordUpdate("proj1", "main", "BB"); // 2 chars

    const result = await stats.getProjectStats("proj1");
    expect(result.threads["main"].currentContentLength).toBe(2);
    expect(result.threads["main"].cumulativeInputLength).toBe(12);
  });

  it("tracks multiple threads independently", async () => {
    await stats.recordUpdate("proj1", "main", "Main content");
    await stats.recordUpdate("proj1", "auth", "Auth content here");
    await stats.recordUpdate("proj1", "main", "Main updated");

    const result = await stats.getProjectStats("proj1");
    expect(result.threads["main"].updateCount).toBe(2);
    expect(result.threads["auth"].updateCount).toBe(1);
    expect(result.threads["main"].cumulativeInputLength).toBe(
      "Main content".length + "Main updated".length
    );
    expect(result.threads["auth"].cumulativeInputLength).toBe(
      "Auth content here".length
    );
  });

  it("returns empty threads for unknown project", async () => {
    const result = await stats.getProjectStats("nonexistent");
    expect(result.projectId).toBe("nonexistent");
    expect(result.threads).toEqual({});
  });

  it("persists stats across service instances", async () => {
    await stats.recordUpdate("proj1", "main", "Content here");

    // Create a new stats service with the same storage
    const stats2 = new StatsServiceImpl(storage);
    const result = await stats2.getProjectStats("proj1");
    expect(result.threads["main"].updateCount).toBe(1);
    expect(result.threads["main"].cumulativeInputLength).toBe(12);
  });
});
