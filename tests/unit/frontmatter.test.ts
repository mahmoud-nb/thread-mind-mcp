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

  it("keeps ordinary values unquoted", () => {
    const result = serializeFrontmatter(
      {
        id: "auth-system",
        title: "Système d'authentification (v2)",
        parentId: "main",
        author: "mahmoud-a3f9",
        createdAt: "2026-04-15T10:00:00Z",
        updatedAt: "2026-04-15T12:30:00Z",
      },
      ""
    );
    expect(result).toContain("title: Système d'authentification (v2)\n");
    expect(result).toContain("createdAt: 2026-04-15T10:00:00Z\n");
    expect(result).not.toContain('"');
  });
});

describe("frontmatter robustness", () => {
  const base: ThreadMetadata = {
    id: "t",
    title: "",
    parentId: "main",
    author: "dev-1234",
    createdAt: "2026-04-15T10:00:00Z",
    updatedAt: "2026-04-15T10:00:00Z",
  };

  it.each([
    "Refactor --- phase 2",
    "Innocent\nid: ../../../PWNED",
    "Line\r\nbreak",
    "Auth: JWT",
    "Issue #42",
    '"quoted"',
    "'single'",
    "- draft",
    "null",
    "True",
    "  padded  ",
    "tab\tinside",
    "认证模块",
  ])("round-trips the title %j without leaking into other fields", (title) => {
    const metadata = { ...base, title };
    const serialized = serializeFrontmatter(metadata, "Body.");

    const parsed = parseFrontmatter(serialized);
    expect(parsed.metadata).toEqual(metadata);
    expect(parsed.content).toBe("Body.");
  });

  it("distinguishes a thread named 'null' from a missing parent", () => {
    const metadata = { ...base, parentId: "null" };
    const parsed = parseFrontmatter(serializeFrontmatter(metadata, ""));
    expect(parsed.metadata.parentId).toBe("null");
  });

  it("only closes the block on a line that is exactly ---", () => {
    const raw = `---
id: t
title: Refactor --- phase 2
parentId: main
author: dev
createdAt: 2026-01-01T00:00:00Z
updatedAt: 2026-01-01T00:00:00Z
---

Summary with a rule below.

---

More content.`;

    const result = parseFrontmatter(raw);
    expect(result.metadata.title).toBe("Refactor --- phase 2");
    expect(result.metadata.parentId).toBe("main");
    expect(result.metadata.author).toBe("dev");
    expect(result.content).toBe(
      "Summary with a rule below.\n\n---\n\nMore content."
    );
  });

  it("parses files with CRLF line endings", () => {
    const raw =
      "---\r\nid: t\r\ntitle: Windows\r\nparentId: null\r\nauthor: dev\r\ncreatedAt: a\r\nupdatedAt: b\r\n---\r\n\r\nLine 1\r\nLine 2";
    const result = parseFrontmatter(raw);
    expect(result.metadata.title).toBe("Windows");
    expect(result.metadata.parentId).toBeNull();
    expect(result.content).toBe("Line 1\r\nLine 2");
  });
});
