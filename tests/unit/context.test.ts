import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StorageServiceImpl } from "../../src/core/storage.js";
import {
  ContextServiceImpl,
  estimateTokens,
  formatContext,
} from "../../src/core/context.js";
import type { ThreadMetadata } from "../../src/types/index.js";

// Stands for the repository: ThreadMind data lives in root/.threadmind
let root: string;
let storage: StorageServiceImpl;
let context: ContextServiceImpl;

async function project(systemContext = "") {
  await storage.writeProjectConfig({
    id: "proj",
    title: "Test",
    systemContext,
    mode: "solo",
    rootThreadId: "main",
  });
}

async function thread(
  id: string,
  parentId: string | null,
  content: string,
  extra: Partial<ThreadMetadata> = {}
) {
  await storage.writeThread("proj", {
    metadata: {
      id,
      title: id[0].toUpperCase() + id.slice(1),
      parentId,
      author: "user",
      createdAt: "",
      updatedAt: "",
      ...extra,
    },
    content,
  });
}

function git(...args: string[]): string {
  return execFileSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args],
    { cwd: root, encoding: "utf-8" }
  ).trim();
}

async function commitFile(path: string, content: string): Promise<string> {
  await mkdir(join(root, path, ".."), { recursive: true });
  await writeFile(join(root, path), content);
  git("add", path);
  git("commit", "-q", "-m", `change ${path}`);
  return git("rev-parse", "HEAD");
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "threadmind-ctx-"));
  storage = new StorageServiceImpl(join(root, ".threadmind"));
  await storage.ensureInitialized();
  context = new ContextServiceImpl(storage);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("estimateTokens", () => {
  it("estimates tokens from text length", () => {
    // ~3.5 chars per token
    expect(estimateTokens("Hello world")).toBe(Math.ceil(11 / 3.5));
  });

  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });
});

describe("ContextService", () => {
  it("assembles context from a single root thread", async () => {
    await project("Be helpful.");
    await thread("main", null, "Project overview.");

    const result = await context.assemble("proj", "main");
    expect(result.text).toContain("## System Context");
    expect(result.text).toContain("Be helpful.");
    expect(result.text).toContain("## Thread: Main (active)");
    expect(result.text).toContain("Project overview.");
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.threadDepth).toBe(1);
  });

  it("assembles context walking up a 3-level chain", async () => {
    await project();
    await thread("main", null, "Root context.");
    await thread("child", "main", "Child context.");
    await thread("grandchild", "child", "Grandchild context.");

    const result = await context.assemble("proj", "grandchild");

    // Should be in order: root → child → grandchild
    const rootIdx = result.text.indexOf("Root context.");
    const childIdx = result.text.indexOf("Child context.");
    const grandchildIdx = result.text.indexOf("Grandchild context.");
    expect(rootIdx).toBeLessThan(childIdx);
    expect(childIdx).toBeLessThan(grandchildIdx);
    expect(result.text).toContain("Grandchild (active)");
    expect(result.text).not.toContain("Main (active)");
    expect(result.threadDepth).toBe(3);
  });

  it("skips empty summaries", async () => {
    await project();
    await thread("main", null, "");
    await thread("child", "main", "Has content.");

    const result = await context.assemble("proj", "child");
    expect(result.text).not.toContain("## Thread: Main");
    expect(result.text).toContain("## Thread: Child (active)");
  });

  it("passes on only the durable sections of ancestors", async () => {
    await project();
    await thread(
      "main",
      null,
      "## Decisions\n- Monorepo\n\n## State\n- Setting up CI\n\n## Next steps\n- Add linting"
    );
    await thread("child", "main", "## Decisions\n- JWT\n\n## State\n- Login done");

    const result = await context.assemble("proj", "child");
    expect(result.text).toContain("- Monorepo");
    expect(result.text).not.toContain("Setting up CI");
    expect(result.text).not.toContain("Add linting");
    // The active thread keeps its whole summary
    expect(result.text).toContain("## State\n- Login done");
  });

  it("marks closed threads", async () => {
    await project();
    await thread("main", null, "Root.");
    await thread("child", "main", "Done work.", { status: "done" });

    const result = await context.assemble("proj", "child");
    expect(result.text).toContain("## Thread: Child [done] (active)");
  });

  it("leaves out the farthest ancestors to fit a token budget", async () => {
    await project();
    await thread("main", null, "r".repeat(700));
    await thread("child", "main", "c".repeat(700));
    await thread("leaf", "child", "Leaf summary.");

    const result = await context.assemble("proj", "leaf", { maxTokens: 250 });

    expect(result.omitted).toEqual(["main"]);
    expect(result.text).not.toContain("## Thread: Main");
    expect(result.text).toContain("## Thread: Child");
    expect(result.tokens).toBeLessThanOrEqual(250);
    expect(formatContext(result)).toContain(
      "_Left out to fit the token budget: main"
    );
  });

  it("cuts the active thread when it alone exceeds the budget", async () => {
    await project();
    await thread("main", null, "m".repeat(2000));

    const result = await context.assemble("proj", "main", { maxTokens: 100 });
    expect(result.truncated).toBe(true);
    expect(result.tokens).toBeLessThanOrEqual(100);
  });

  it("rejects unknown threads", async () => {
    await project();
    await thread("main", null, "Root.");

    await expect(context.assemble("proj", "ghost")).rejects.toThrow(
      'Thread "ghost" not found'
    );
  });

  it("detects circular references", async () => {
    await project();
    // A hand-edited cycle: A → B → A
    await thread("a", "b", "A content.");
    await thread("b", "a", "B content.");

    await expect(context.assemble("proj", "a")).rejects.toThrow(
      "Circular reference detected"
    );
  });

  it("respects MAX_DEPTH limit", async () => {
    await project();
    // Create a chain of 60 threads (exceeds MAX_DEPTH of 50)
    for (let i = 0; i < 60; i++) {
      await thread(`t-${i}`, i === 0 ? null : `t-${i - 1}`, `Content ${i}.`);
    }

    // Assembling from t-59 should stop at depth 50, not crash
    const result = await context.assemble("proj", "t-59");
    expect(result.threadDepth).toBeLessThanOrEqual(50);
  });

  describe("outdated summaries", () => {
    beforeEach(() => {
      git("init", "-q", "-b", "main");
    });

    it("flags summaries whose paths changed since they were written", async () => {
      const written = await commitFile("src/auth/jwt.ts", "v1");
      await commitFile("src/auth/jwt.ts", "v2");
      await commitFile("docs/readme.md", "unrelated");
      await project();
      await thread("main", null, "Auth uses JWT.", {
        commit: written,
        paths: ["src/auth"],
      });

      const result = await context.assemble("proj", "main");
      expect(result.text).toContain(
        "_⚠ 1 commit changed src/auth since this summary was written: check it is still accurate._"
      );
    });

    it("stays quiet when the paths did not change", async () => {
      const written = await commitFile("src/auth/jwt.ts", "v1");
      await commitFile("docs/readme.md", "unrelated");
      await project();
      await thread("main", null, "Auth uses JWT.", {
        commit: written,
        paths: ["src/auth"],
      });

      const result = await context.assemble("proj", "main");
      expect(result.text).not.toContain("⚠");
    });

    it("gives the age of summaries without paths", async () => {
      const written = await commitFile("a.txt", "1");
      await commitFile("b.txt", "2");
      await commitFile("c.txt", "3");
      await project();
      await thread("main", null, "Overview.", { commit: written });

      const result = await context.assemble("proj", "main");
      expect(result.text).toContain("_Written 2 commits ago._");
    });

    it("warns about commits missing from the history", async () => {
      await commitFile("a.txt", "1");
      await project();
      await thread("main", null, "Overview.", { commit: "0123456789abcdef0123456789abcdef01234567" });

      const result = await context.assemble("proj", "main");
      expect(result.text).toContain(
        "_⚠ Written on commit 0123456, which is not in this repository's history"
      );
    });
  });
});
