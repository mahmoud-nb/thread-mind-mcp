import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../src/server.js";
import type { Services } from "../../src/types/index.js";

// Stands for the user's repository; ThreadMind data lives in root/.threadmind
let root: string;
let services: Services;
let client: Client;

beforeEach(async () => {
  delete process.env.THREADMIND_AUTHOR;
  root = await mkdtemp(join(tmpdir(), "threadmind-e2e-"));
  const created = createServer(join(root, ".threadmind"));
  services = created.services;

  client = new Client({ name: "e2e", version: "0.0.0" });
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    created.server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
});

afterEach(async () => {
  await client.close();
  await rm(root, { recursive: true, force: true });
});

async function call(
  name: string,
  args: Record<string, unknown> = {}
): Promise<{ text: string; isError: boolean }> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text: string }[];
  return {
    text: content.map((c) => c.text).join("\n"),
    isError: result.isError === true,
  };
}

describe("MCP server (end to end)", () => {
  it("renders the thread tree with connectors", async () => {
    await call("project_create", { title: "Shop" });
    await call("thread_create", { title: "Auth" });
    await call("thread_create", { title: "Auth UI" });
    await call("thread_switch", { threadId: "main" });
    await call("thread_create", { title: "Dashboard" });

    const { text } = await call("thread_list");
    expect(text).toBe(
      [
        "main",
        "├── auth",
        "│   └── auth-ui",
        "└── dashboard ← active",
      ].join("\n")
    );
  });

  it("rejects path traversal before touching the file system", async () => {
    await call("project_create", { title: "P" });
    const victim = join(root, "docs", "index.md");
    const original = "---\nlayout: home\n---\n\n# Docs home\n";
    await mkdir(join(root, "docs"));
    await writeFile(victim, original);

    const traversal = "../../../docs/index";
    for (const [tool, args] of [
      ["thread_delete", { threadId: traversal }],
      ["summary_update", { threadId: traversal, content: "overwritten" }],
      ["thread_switch", { threadId: traversal }],
      ["thread_rebase", { threadId: traversal, newParentId: "main" }],
      ["thread_create", { title: "x", parentId: traversal }],
      ["project_switch", { projectId: "../../package" }],
    ] as const) {
      const result = await call(tool, args);
      expect(result.isError, tool).toBe(true);
      expect(result.text, tool).toContain(
        "only contain lowercase letters, digits and hyphens"
      );
    }

    expect(await readFile(victim, "utf-8")).toBe(original);
  });

  it("neutralizes line breaks in titles", async () => {
    await call("project_create", { title: "P" });
    const created = await call("thread_create", {
      title: "Innocent\nid: ../../../PWNED",
    });
    expect(created.isError).toBe(false);

    const updated = await call("summary_update", { content: "content" });
    expect(updated.isError).toBe(false);

    expect(existsSync(join(root, "PWNED.md"))).toBe(false);
    const node = await services.storage.readThread("p", "innocent-id-pwned");
    expect(node.metadata.title).toBe("Innocent id: ../../../PWNED");
    expect(node.content).toBe("content");
  });

  it("keeps metadata intact for titles containing ---", async () => {
    await call("project_create", { title: "P", mode: "team" });
    await call("thread_create", { title: "Refactor --- phase 2" });

    const updated = await call("summary_update", { content: "New summary" });
    expect(updated).toEqual({
      text: 'Summary updated for thread "refactor-phase-2".',
      isError: false,
    });

    const context = await call("context_get");
    expect(context.text).toContain(
      "## Thread: Refactor --- phase 2 (active)\n\nNew summary"
    );
    expect(context.text).not.toContain("parentId:");
  });

  it("gives a teammate joining a team project an author ID", async () => {
    await call("project_create", { title: "Team App", mode: "team" });
    // A teammate clones the repository: no local config.json
    await rm(join(root, ".threadmind", "config.json"));

    await call("project_switch", { projectId: "team-app" });
    await call("thread_create", { title: "Teammate work" });

    const node = await services.storage.readThread(
      "team-app",
      "teammate-work"
    );
    expect(node.metadata.author).toMatch(/^[a-z0-9-]+-[0-9a-f]{4}$/);

    // Someone else cannot rewrite that teammate's summary
    process.env.THREADMIND_AUTHOR = "someone-else";
    const intruder = await call("summary_update", {
      threadId: "teammate-work",
      content: "Hijacked",
    });
    expect(intruder.isError).toBe(true);
    expect(intruder.text).toContain("Cannot update thread");
  });

  it("keeps every thread when tool calls run in parallel", async () => {
    await call("project_create", { title: "P" });
    const results = await Promise.all(
      ["A", "B", "C"].map((title) =>
        call("thread_create", { title, parentId: "main" })
      )
    );
    expect(results.every((r) => !r.isError)).toBe(true);

    const tree = await services.storage.readTree("p");
    expect([...tree.nodes["main"].children].sort()).toEqual(["a", "b", "c"]);
  });

  it("derives readable IDs from non-Latin titles", async () => {
    await call("project_create", { title: "Système d'authentification" });
    const created = await call("thread_create", { title: "认证模块" });

    expect(created.text).toContain('Thread "thread" created under "main"');
    const projects = await call("project_list");
    expect(projects.text).toContain("(systeme-dauthentification)");
  });

  it("reports the package version", () => {
    const { version } = createRequire(import.meta.url)(
      "../../package.json"
    ) as { version: string };
    expect(client.getServerVersion()?.version).toBe(version);
  });
});
