import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  serializeFrontmatter,
} from "../../src/core/frontmatter.js";
import type { ThreadMetadata } from "../../src/types/index.js";

describe("parseFrontmatter", () => {
  it("parses a valid frontmatter block", () => {
    const raw = `---
id: feature-auth
title: Authentication System
parentId: main
author: mahmoud-a3f9
createdAt: 2026-04-15T10:00:00Z
updatedAt: 2026-04-15T12:30:00Z
---

This is the summary content.`;

    const result = parseFrontmatter(raw);
    expect(result.metadata.id).toBe("feature-auth");
    expect(result.metadata.title).toBe("Authentication System");
    expect(result.metadata.parentId).toBe("main");
    expect(result.metadata.author).toBe("mahmoud-a3f9");
    expect(result.content).toBe("This is the summary content.");
  });

  it("parses null parentId", () => {
    const raw = `---
id: main
title: Main
parentId: null
author: user
createdAt: 2026-01-01T00:00:00Z
updatedAt: 2026-01-01T00:00:00Z
---

Root thread.`;

    const result = parseFrontmatter(raw);
    expect(result.metadata.parentId).toBeNull();
  });

  it("handles empty content", () => {
    const raw = `---
id: test
title: Test
parentId: null
author: user
createdAt: 2026-01-01T00:00:00Z
updatedAt: 2026-01-01T00:00:00Z
---`;

    const result = parseFrontmatter(raw);
    expect(result.content).toBe("");
  });

  it("throws on missing opening ---", () => {
    expect(() => parseFrontmatter("no frontmatter")).toThrow(
      "missing opening ---"
    );
  });

  it("throws on missing closing ---", () => {
    expect(() => parseFrontmatter("---\nid: test\n")).toThrow(
      "missing closing ---"
    );
  });
});

describe("serializeFrontmatter", () => {
  it("serializes metadata and content", () => {
    const metadata: ThreadMetadata = {
      id: "feature-auth",
      title: "Auth System",
      parentId: "main",
      author: "mahmoud-a3f9",
      createdAt: "2026-04-15T10:00:00Z",
      updatedAt: "2026-04-15T12:30:00Z",
    };

    const result = serializeFrontmatter(metadata, "Summary content.");
    expect(result).toContain("---");
    expect(result).toContain("id: feature-auth");
    expect(result).toContain("parentId: main");
    expect(result).toContain("Summary content.");
  });

  it("serializes null parentId as 'null'", () => {
    const metadata: ThreadMetadata = {
      id: "main",
      title: "Main",
      parentId: null,
      author: "user",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    const result = serializeFrontmatter(metadata, "");
    expect(result).toContain("parentId: null");
  });

  it("roundtrips correctly", () => {
    const metadata: ThreadMetadata = {
      id: "test-thread",
      title: "Test Thread",
      parentId: "main",
      author: "dev-1234",
      createdAt: "2026-04-15T10:00:00Z",
      updatedAt: "2026-04-15T12:30:00Z",
    };
    const content = "Some summary with **markdown**.";

    const serialized = serializeFrontmatter(metadata, content);
    const parsed = parseFrontmatter(serialized);

    expect(parsed.metadata).toEqual(metadata);
    expect(parsed.content).toBe(content);
  });
});
