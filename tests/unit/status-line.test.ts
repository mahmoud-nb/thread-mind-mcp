import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { statusLine } from "../../src/hooks/status-line.js";
import { SessionCache } from "../../src/hooks/session-cache.js";
import { createServices } from "../../src/services.js";
import type { Services } from "../../src/types/index.js";

let root: string;
let services: Services;
let cache: SessionCache;

const input = (extra: object = {}) => ({
  session_id: "s1",
  workspace: { project_dir: root, current_dir: root },
  context_window: { context_window_size: 200_000, used_percentage: 41.6 },
  ...extra,
});

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "threadmind-status-"));
  services = createServices(join(root, ".threadmind"));
  cache = new SessionCache(join(root, "cache"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("status line", () => {
  it("is empty outside a ThreadMind workspace, and creates nothing", async () => {
    expect(await statusLine(input(), {}, cache)).toBe("");
    expect(existsSync(join(root, ".threadmind"))).toBe(false);
  });

  it("shows the active thread, its summary's age and the context use", async () => {
    await services.project.create({ title: "Shop" });
    expect(await statusLine(input(), {}, cache)).toBe(
      "🧵 main · no summary yet · ctx 42%"
    );

    await services.thread.updateSummary({
      projectId: "shop",
      threadId: "main",
      content: "## State\n- Done",
      author: "me",
      mode: "solo",
    });
    const { metadata } = await services.storage.readThread("shop", "main");
    const threeHoursLater = Date.parse(metadata.updatedAt) + 3 * 3_600_000;

    expect(await statusLine(input(), {}, cache, threeHoursLater)).toBe(
      "🧵 main · saved 3h ago · ctx 42%"
    );
  });

  it("shows the work the hooks counted as unsaved, flagged past the reminder interval", async () => {
    await services.project.create({ title: "Shop" });
    await cache.writeWatch("s1", {
      projectId: "shop",
      threadId: "main",
      unsaved: 62_400,
    });

    expect(await statusLine(input(), {}, cache)).toContain("⚠ ~62k unsaved");
    expect(
      await statusLine(input(), { THREADMIND_REMINDER_TOKENS: "100000" }, cache)
    ).toContain(" · ~62k unsaved");
  });

  it("reports the context window size to the hooks", async () => {
    await statusLine(input(), {}, cache);
    expect(await cache.readWindow("s1")).toBe(200_000);
  });
});
