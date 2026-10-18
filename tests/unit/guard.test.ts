import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { HookGuard, type HookCall } from "../../src/hooks/guard.js";
import { SessionCache } from "../../src/hooks/session-cache.js";
import {
  DEFAULT_HOOK_SETTINGS,
  type HookSettings,
} from "../../src/hooks/settings.js";
import { createServices } from "../../src/services.js";
import type { Services } from "../../src/types/index.js";
import { commitFile, git } from "../helpers/git.js";

// Stands for the repository where Claude Code runs
let root: string;
let services: Services;
let cache: SessionCache;
let transcriptPath: string;

// Turns recorded before and after any summary saved during a test
const BEFORE = "2000-01-01T00:00:00.000Z";
const AFTER = "2999-01-01T00:00:00.000Z";

function guardWith(settings: Partial<HookSettings> = {}): HookGuard {
  return new HookGuard(services, { ...DEFAULT_HOOK_SETTINGS, ...settings }, cache);
}

/** A main-conversation turn whose context holds `size` tokens. */
function turn(size: number, timestamp = AFTER): string {
  return (
    JSON.stringify({
      type: "assistant",
      timestamp,
      message: { model: "claude", usage: { input_tokens: size, output_tokens: 0 } },
    }) + "\n"
  );
}

async function conversation(...sizes: number[]): Promise<void> {
  await writeFile(transcriptPath, sizes.map((s) => turn(s)).join(""));
}

async function grow(size: number): Promise<void> {
  await appendFile(transcriptPath, turn(size));
}

const stop = (extra: Partial<HookCall> = {}): HookCall => ({
  event: "stop",
  session_id: "s1",
  transcript_path: transcriptPath,
  stop_hook_active: "false",
  ...extra,
});

function reminderOf(output: Record<string, unknown> | null): string | undefined {
  const specific = output?.hookSpecificOutput as
    | { additionalContext?: string }
    | undefined;
  return specific?.additionalContext;
}

async function saveSummary(content = "## State\n- Saved"): Promise<void> {
  await services.thread.updateSummary({
    projectId: "shop",
    threadId: "main",
    content,
    author: "me",
    mode: "solo",
  });
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "threadmind-guard-"));
  services = createServices(join(root, ".threadmind"));
  cache = new SessionCache(join(root, "cache"));
  transcriptPath = join(root, "session.jsonl");
  await services.project.create({ title: "Shop" });
  await services.session.selectThread("shop", "main");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("Stop reminders", () => {
  it("count the work since the first turn and nudge Claude past the interval", async () => {
    const guard = guardWith();
    await conversation(20_000, 50_000);
    expect(await guard.handle(stop())).toBeNull();

    await grow(80_000);
    const reminder = reminderOf(await guard.handle(stop()));
    expect(reminder).toContain('~60k tokens of conversation since the summary of thread "main"');
    expect(reminder).toContain("summary_update");
  });

  it("count only the work done since the summary was last saved", async () => {
    const guard = guardWith();
    await saveSummary();
    await writeFile(
      transcriptPath,
      turn(10_000, BEFORE) + turn(40_000, BEFORE) + turn(95_000)
    );

    expect(reminderOf(await guard.handle(stop()))).toContain("~55k tokens");
  });

  it("wait for another interval after a reminder, and never chain them", async () => {
    const guard = guardWith();
    await conversation(10_000, 70_000);
    expect(reminderOf(await guard.handle(stop()))).toBeDefined();

    // Claude answered the reminder without saving anything
    await grow(72_000);
    expect(await guard.handle(stop({ stop_hook_active: "true" }))).toBeNull();
    await grow(100_000);
    expect(await guard.handle(stop())).toBeNull();
    await grow(125_000);
    expect(reminderOf(await guard.handle(stop()))).toContain("~115k tokens");
  });

  it("start counting again once the summary is saved", async () => {
    const guard = guardWith();
    await conversation(10_000, 70_000);
    expect(reminderOf(await guard.handle(stop()))).toBeDefined();

    await saveSummary();
    await grow(75_000);
    expect(await guard.handle(stop({ stop_hook_active: true }))).toBeNull();
    await grow(120_000);
    expect(await guard.handle(stop())).toBeNull();
    await grow(126_000);
    expect(reminderOf(await guard.handle(stop()))).toContain("~51k tokens");
  });

  it("send a last reminder when the context window is nearly full", async () => {
    const guard = guardWith({ contextWindow: 100_000 });
    await conversation(50_000, 60_000);
    expect(await guard.handle(stop())).toBeNull();

    await grow(72_000);
    const reminder = reminderOf(await guard.handle(stop()));
    expect(reminder).toContain("about 72% of the context window");
    expect(reminder).toContain("Before the conversation gets compacted");

    // Only once
    await grow(85_000);
    expect(await guard.handle(stop())).toBeNull();
  });

  it("use the context window size reported by the status line", async () => {
    const guard = guardWith();
    await cache.writeWindow("s1", 100_000);
    await conversation(50_000, 75_000);

    expect(reminderOf(await guard.handle(stop()))).toContain("about 75% of the context window");
  });

  it("fall back to a 200k window, and describe the size instead", async () => {
    const guard = guardWith();
    await conversation(130_000, 150_000);

    expect(reminderOf(await guard.handle(stop()))).toContain("the conversation is ~150k tokens long");
  });

  it("only tell the user in warn mode", async () => {
    const guard = guardWith({ reminders: "warn" });
    await conversation(10_000, 70_000);

    const output = await guard.handle(stop());
    expect(output?.systemMessage).toContain("Type tm:summary");
    expect(output?.hookSpecificOutput).toBeUndefined();
  });

  it("stay silent when off, on closed threads and without a transcript", async () => {
    await conversation(10_000, 70_000);
    expect(await guardWith({ reminders: "off" }).handle(stop())).toBeNull();
    expect(await guardWith().handle(stop({ transcript_path: "${transcript_path}" }))).toBeNull();

    await services.thread.create({ projectId: "shop", parentId: "main", title: "Done", author: "me" });
    await services.thread.setStatus({ projectId: "shop", threadId: "done", status: "done", author: "me", mode: "solo" });
    await services.session.selectThread("shop", "done");
    expect(await guardWith().handle(stop())).toBeNull();
  });

  it("share the unsaved work with the status line", async () => {
    await conversation(10_000, 30_000);
    await guardWith().handle(stop());

    expect(await cache.readWatch("s1")).toEqual({
      projectId: "shop",
      threadId: "main",
      unsaved: 20_000,
    });
  });
});

describe("compaction", () => {
  const preCompact: HookCall = { event: "pre-compact", session_id: "s1", trigger: "auto" };
  const afterCompact: HookCall = { event: "session-start", session_id: "s1", source: "compact" };

  it("asks Claude to save the summary first when the compaction lost unsaved work", async () => {
    const guard = guardWith();
    await conversation(10_000, 40_000);
    expect(await guard.handle({ ...preCompact, transcript_path: transcriptPath })).toBeNull();

    const output = await guard.handle(afterCompact);
    const context = reminderOf(output);
    expect(context).toContain('compacted before the summary of thread "main" was saved (~30k tokens of work)');
    expect(context).toContain("Before anything else, call summary_update");

    // Asked once
    expect(reminderOf(await guard.handle(afterCompact))).toContain(
      "if the compaction summary mentions decisions"
    );
  });

  it("only suggests checking the summary when the option is off or the work was saved", async () => {
    await conversation(10_000, 40_000);
    const off = guardWith({ compactSummary: false });
    await off.handle({ ...preCompact, transcript_path: transcriptPath });
    expect(reminderOf(await off.handle(afterCompact))).not.toContain("Before anything else");

    const guard = guardWith();
    await saveSummary();
    await writeFile(transcriptPath, turn(39_000, BEFORE) + turn(40_000));
    await guard.handle({ ...preCompact, transcript_path: transcriptPath });
    expect(reminderOf(await guard.handle(afterCompact))).not.toContain("Before anything else");
  });
});

describe("/clear", () => {
  it("tells the user once when the cleared conversation had unsaved work", async () => {
    const guard = guardWith();
    await conversation(10_000, 40_000);
    await guard.handle(stop());

    const cleared: HookCall = { event: "session-start", session_id: "s2", source: "clear" };
    const output = await guard.handle(cleared);
    expect(output?.systemMessage).toContain('~30k tokens of work that was not saved in thread "main"');
    expect(reminderOf(output)).toContain('active thread "main"');

    expect((await guard.handle(cleared))?.systemMessage).toBeUndefined();
  });
});

describe("instant commands", () => {
  const prompt = (text: string): HookCall => ({ event: "user-prompt", session_id: "s1", prompt: text });

  it("answer tm:tree and tm:stats without Claude", async () => {
    const guard = guardWith();

    const tree = await guard.handle(prompt("tm:tree"));
    expect(tree).toMatchObject({
      decision: "block",
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", suppressOriginalPrompt: true },
    });
    expect(tree?.reason).toContain("main ← active");

    expect((await guard.handle(prompt(" /thread-mind:stats ")))?.reason).toContain(
      'ThreadMind Stats: "Shop"'
    );
  });

  it("leave other prompts, disabled commands and missing projects to Claude", async () => {
    expect(await guardWith().handle(prompt("tm:tree please"))).toBeNull();
    expect(await guardWith({ instantCommands: false }).handle(prompt("tm:tree"))).toBeNull();

    const empty = await mkdtemp(join(tmpdir(), "threadmind-guard-empty-"));
    try {
      const guard = new HookGuard(
        createServices(join(empty, ".threadmind")),
        DEFAULT_HOOK_SETTINGS,
        cache
      );
      expect(await guard.handle(prompt("tm:tree"))).toBeNull();
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});

describe("git branch changes", () => {
  it("give Claude the new active thread's context", async () => {
    git(root, "init", "-q", "-b", "main");
    await commitFile(root, "README.md", "hello");
    git(root, "checkout", "-q", "-b", "feature/billing");
    await services.thread.create({
      projectId: "shop",
      parentId: "main",
      title: "Billing",
      author: "me",
      branch: "feature/billing",
    });
    git(root, "checkout", "-q", "main");

    const guard = guardWith();
    // Claude was told about the starting thread
    expect(await guard.handle({ event: "user-prompt", prompt: "hi" })).toBeNull();

    git(root, "checkout", "-q", "feature/billing");
    const context = reminderOf(await guard.handle({ event: "branch-check" }));
    expect(context).toContain('The checked-out git branch is now "feature/billing"');
    expect(context).toContain('active thread changed to "billing"');
    expect(await guard.handle({ event: "branch-check" })).toBeNull();

    // A thread Claude switched to itself needs no announcement
    await services.session.selectThread("shop", "main");
    expect(await guard.handle({ event: "user-prompt", prompt: "hi" })).toBeNull();
  });
});

describe("edited files", () => {
  it("are remembered per thread, relative to the workspace", async () => {
    const guard = guardWith();
    const edit = (file_path: string) => guard.handle({ event: "file-edited", file_path });

    await edit(join(root, "src", "cart.ts"));
    await edit("src/pay.ts");
    await edit(join(root, "src", "cart.ts"));
    await edit(join(root, ".threadmind", "config.json"));
    await edit(join(root, "..", "elsewhere.ts"));

    expect(guard.takeTouchedPaths("shop", "main")).toEqual(["src/pay.ts", "src/cart.ts"]);
    expect(guard.takeTouchedPaths("shop", "main")).toEqual([]);
  });
});
