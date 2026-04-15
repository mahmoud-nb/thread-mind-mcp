import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StorageServiceImpl } from "../../src/core/storage.js";
import {
  ContextServiceImpl,
  estimateTokens,
} from "../../src/core/context.js";

let tempDir: string;
let storage: StorageServiceImpl;
let context: ContextServiceImpl;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "threadmind-ctx-"));
  storage = new StorageServiceImpl(tempDir);
  await storage.ensureInitialized();
  context = new ContextServiceImpl(storage);
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("estimateTokens", () => {
  it("estimates tokens from text length", () => {
    // ~3.5 chars per token
    const tokens = estimateTokens("Hello world"); // 11 chars
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(Math.ceil(11 / 3.5));
  });

  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("scales with text length", () => {
    const short = estimateTokens("short");
    const long = estimateTokens("a".repeat(1000));
    expect(long).toBeGreaterThan(short);
  });
});

describe("ContextService", () => {
  it("assembles context from a single root thread", async () => {
    await storage.writeProjectConfig({
      id: "proj",
      title: "Test",
      systemContext: "Be helpful.",
      mode: "solo",
      rootThreadId: "main",
    });

    await storage.writeThread("proj", {
      metadata: {
        id: "main",
        title: "Main Thread",
        parentId: null,
        author: "user",
        createdAt: "",
        updatedAt: "",
      },
      content: "Project overview.",
    });

    await storage.writeTree("proj", {
      nodes: { main: { parentId: null, children: [] } },
    });

    const result = await context.assemble("proj", "main");
    expect(result.text).toContain("## System Context");
    expect(result.text).toContain("Be helpful.");
    expect(result.text).toContain("## Thread: Main Thread (active)");
    expect(result.text).toContain("Project overview.");
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.threadDepth).toBe(1);
  });

  it("assembles context walking up a 3-level chain", async () => {
    await storage.writeProjectConfig({
      id: "proj",
      title: "Test",
      systemContext: "",
      mode: "solo",
      rootThreadId: "main",
    });

    await storage.writeThread("proj", {
      metadata: {
        id: "main",
        title: "Root",
        parentId: null,
        author: "user",
        createdAt: "",
        updatedAt: "",
      },
      content: "Root context.",
    });

    await storage.writeThread("proj", {
      metadata: {
        id: "child",
        title: "Child",
        parentId: "main",
        author: "user",
        createdAt: "",
        updatedAt: "",
      },
      content: "Child context.",
    });

    await storage.writeThread("proj", {
      metadata: {
        id: "grandchild",
        title: "Grandchild",
        parentId: "child",
        author: "user",
        createdAt: "",
        updatedAt: "",
      },
      content: "Grandchild context.",
    });

    await storage.writeTree("proj", {
      nodes: {
        main: { parentId: null, children: ["child"] },
        child: { parentId: "main", children: ["grandchild"] },
        grandchild: { parentId: "child", children: [] },
      },
    });

    const result = await context.assemble("proj", "grandchild");

    // Should be in order: root → child → grandchild
    const rootIdx = result.text.indexOf("Root context.");
    const childIdx = result.text.indexOf("Child context.");
    const grandchildIdx = result.text.indexOf("Grandchild context.");

    expect(rootIdx).toBeLessThan(childIdx);
    expect(childIdx).toBeLessThan(grandchildIdx);
    expect(result.text).toContain("Grandchild (active)");
    expect(result.text).not.toContain("Root (active)");
    expect(result.threadDepth).toBe(3);
  });

  it("skips empty summaries", async () => {
    await storage.writeProjectConfig({
      id: "proj",
      title: "Test",
      systemContext: "",
      mode: "solo",
      rootThreadId: "main",
    });

    await storage.writeThread("proj", {
      metadata: {
        id: "main",
        title: "Root",
        parentId: null,
        author: "user",
        createdAt: "",
        updatedAt: "",
      },
      content: "",
    });

    await storage.writeThread("proj", {
      metadata: {
        id: "child",
        title: "Child",
        parentId: "main",
        author: "user",
        createdAt: "",
        updatedAt: "",
      },
      content: "Has content.",
    });

    await storage.writeTree("proj", {
      nodes: {
        main: { parentId: null, children: ["child"] },
        child: { parentId: "main", children: [] },
      },
    });

    const result = await context.assemble("proj", "child");
    expect(result.text).not.toContain("## Thread: Root");
    expect(result.text).toContain("## Thread: Child (active)");
  });

  it("detects circular references", async () => {
    await storage.writeProjectConfig({
      id: "proj",
      title: "Test",
      systemContext: "",
      mode: "solo",
      rootThreadId: "main",
    });

    // Create a circular tree: A → B → A
    await storage.writeThread("proj", {
      metadata: {
        id: "a",
        title: "A",
        parentId: "b",
        author: "user",
        createdAt: "",
        updatedAt: "",
      },
      content: "A content.",
    });

    await storage.writeThread("proj", {
      metadata: {
        id: "b",
        title: "B",
        parentId: "a",
        author: "user",
        createdAt: "",
        updatedAt: "",
      },
      content: "B content.",
    });

    await storage.writeTree("proj", {
      nodes: {
        a: { parentId: "b", children: [] },
        b: { parentId: "a", children: [] },
      },
    });

    await expect(context.assemble("proj", "a")).rejects.toThrow(
      "Circular reference detected"
    );
  });

  it("respects MAX_DEPTH limit", async () => {
    await storage.writeProjectConfig({
      id: "proj",
      title: "Test",
      systemContext: "",
      mode: "solo",
      rootThreadId: "t-0",
    });

    // Create a chain of 60 threads (exceeds MAX_DEPTH of 50)
    const nodes: Record<string, { parentId: string | null; children: string[] }> = {};
    for (let i = 0; i < 60; i++) {
      const id = `t-${i}`;
      const parentId = i === 0 ? null : `t-${i - 1}`;
      nodes[id] = { parentId, children: i < 59 ? [`t-${i + 1}`] : [] };

      await storage.writeThread("proj", {
        metadata: {
          id,
          title: `Thread ${i}`,
          parentId,
          author: "user",
          createdAt: "",
          updatedAt: "",
        },
        content: `Content ${i}.`,
      });
    }

    await storage.writeTree("proj", { nodes });

    // Assembling from t-59 should stop at depth 50, not crash
    const result = await context.assemble("proj", "t-59");
    expect(result.threadDepth).toBeLessThanOrEqual(50);
  });
});
