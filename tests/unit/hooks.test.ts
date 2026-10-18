import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleHook } from "../../src/hooks/index.js";
import { HOOK_TEXT_LIMIT } from "../../src/hooks/session-context.js";
import { conversationSize, transcriptTurns } from "../../src/hooks/transcript.js";
import { createServices } from "../../src/services.js";
import type { Services } from "../../src/types/index.js";

// Stands for the repository where Claude Code runs
let root: string;
let services: Services;

async function setUpProject(summary: string): Promise<void> {
  await services.project.create({ title: "Shop" });
  await services.session.selectThread("shop", "main");
  await services.thread.updateSummary({
    projectId: "shop",
    threadId: "main",
    content: summary,
    author: "me",
    mode: "solo",
  });
}

function transcript(...entries: object[]): string {
  return entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
}

const assistant = (usage: object, extra: object = {}) => ({
  type: "assistant",
  message: { role: "assistant", usage },
  ...extra,
});

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "threadmind-hooks-"));
  services = createServices(join(root, ".threadmind"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("session-start hook", () => {
  it("adds nothing and creates nothing without a project", async () => {
    const output = await handleHook(
      "session-start",
      { cwd: root, session_id: "s1", source: "startup" },
      {}
    );

    expect(output).toBeNull();
    expect(existsSync(join(root, ".threadmind"))).toBe(false);
  });

  it("loads the active thread's context and records its size", async () => {
    await setUpProject("## Decisions\n- Next.js with Stripe");

    const output = await handleHook(
      "session-start",
      { cwd: root, session_id: "s1", source: "clear" },
      {}
    );

    const parsed = JSON.parse(output!);
    expect(parsed.hookSpecificOutput.hookEventName).toBe("SessionStart");
    const context: string = parsed.hookSpecificOutput.additionalContext;
    expect(context).toContain('project "Shop", active thread "main"');
    expect(context).toContain("no need to call context_get");
    expect(context).toContain("- Next.js with Stripe");
    expect(context).not.toContain("compacted");

    const [session] = await services.stats.sessions();
    expect(session).toMatchObject({ sessionId: "s1", source: "clear" });
    expect(session.injectedTokens).toBeGreaterThan(0);
  });

  it("asks to recover decisions after a compaction", async () => {
    await setUpProject("Summary.");

    const output = await handleHook(
      "session-start",
      { cwd: root, session_id: "s1", source: "compact" },
      {}
    );
    expect(output).toContain("The conversation was just compacted");
  });

  it("fits the context in what Claude Code accepts from a hook", async () => {
    await setUpProject(
      "## State\n" + "- A long line of state for the summary\n".repeat(600)
    );

    const output = await handleHook(
      "session-start",
      { cwd: root, session_id: "s1", source: "startup" },
      {}
    );

    const context: string = JSON.parse(output!).hookSpecificOutput.additionalContext;
    expect(context.length).toBeLessThanOrEqual(HOOK_TEXT_LIMIT);
    expect(context).toContain("It was shortened to fit: call context_get");
    expect(context).toContain("Cut to fit the token budget.");
  });

  it("finds the project from CLAUDE_PROJECT_DIR, then THREADMIND_ROOT", async () => {
    await setUpProject("Summary.");
    const elsewhere = { cwd: join(root, "..") };

    expect(
      await handleHook("session-start", elsewhere, { CLAUDE_PROJECT_DIR: root })
    ).toContain("Summary.");
    expect(
      await handleHook("session-start", elsewhere, {
        CLAUDE_PROJECT_DIR: join(root, ".."),
        THREADMIND_ROOT: root,
      })
    ).toContain("Summary.");
  });

  it("rejects unknown hooks", async () => {
    await expect(handleHook("pre-compact", { cwd: root }, {})).rejects.toThrow(
      'Unknown hook "pre-compact"'
    );
  });
});

describe("session-end hook", () => {
  it("records how large the conversation grew", async () => {
    await setUpProject("Summary.");
    const transcriptPath = join(root, "session.jsonl");
    await writeFile(
      transcriptPath,
      transcript(
        { type: "user", message: { role: "user", content: "hi" } },
        assistant({ input_tokens: 100, cache_creation_input_tokens: 20, cache_read_input_tokens: 30000, output_tokens: 50 })
      )
    );

    await handleHook(
      "session-end",
      { cwd: root, session_id: "s1", reason: "clear", transcript_path: transcriptPath },
      {}
    );

    const [session] = await services.stats.sessions();
    expect(session).toMatchObject({
      sessionId: "s1",
      endReason: "clear",
      finalContextTokens: 30170,
    });
  });

  it("does not measure workspaces without ThreadMind", async () => {
    await handleHook(
      "session-end",
      { cwd: root, session_id: "s1", reason: "other" },
      {}
    );
    expect(existsSync(join(root, ".threadmind"))).toBe(false);
  });
});

describe("conversationSize", () => {
  it("reads the last main-conversation turn", async () => {
    const path = join(root, "t.jsonl");
    await writeFile(
      path,
      transcript(
        assistant({ input_tokens: 10, output_tokens: 5 }),
        assistant({ input_tokens: 200, cache_read_input_tokens: 1000, output_tokens: 30 }),
        // A subagent's turn doesn't reflect the main conversation
        assistant({ input_tokens: 99999 }, { isSidechain: true }),
        { type: "summary", summary: "..." }
      ) + '{"type":"assistant","message":{"usa'
    );

    expect(await conversationSize(path)).toBe(1230);
  });

  it("skips the messages Claude Code writes itself", async () => {
    const path = join(root, "t.jsonl");
    await writeFile(
      path,
      transcript(
        assistant(
          { input_tokens: 500, output_tokens: 20 },
          { timestamp: "2026-01-01T00:00:00Z" }
        ),
        {
          type: "assistant",
          message: { model: "<synthetic>", usage: { input_tokens: 0, output_tokens: 0 } },
        }
      )
    );

    expect(await conversationSize(path)).toBe(520);
    expect(await transcriptTurns(path)).toEqual([
      { timestamp: "2026-01-01T00:00:00Z", prompt: 500, size: 520 },
    ]);
  });

  it("returns null without usage data or transcript", async () => {
    const path = join(root, "t.jsonl");
    await writeFile(path, transcript({ type: "user", message: { content: "hi" } }));

    expect(await conversationSize(path)).toBeNull();
    expect(await conversationSize(join(root, "missing.jsonl"))).toBeNull();
  });
});
