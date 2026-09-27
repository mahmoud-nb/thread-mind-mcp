import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ListRootsRequestSchema,
  ResourceListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "../../src/server.js";
import type { Services } from "../../src/types/index.js";
import { commitFile, git } from "../helpers/git.js";

// Stands for the user's repository; ThreadMind data lives in root/.threadmind
let root: string;
let services: Services;
let client: Client;

/** Connect a client; with `roots`, it advertises those directories. */
async function connect(
  server: McpServer,
  roots?: () => string[]
): Promise<Client> {
  const connected = new Client(
    { name: "e2e", version: "0.0.0" },
    roots ? { capabilities: { roots: { listChanged: true } } } : undefined
  );
  if (roots) {
    connected.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: roots().map((dir) => ({ uri: pathToFileURL(dir).href })),
    }));
  }
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    connected.connect(clientTransport),
  ]);
  return connected;
}

beforeEach(async () => {
  delete process.env.THREADMIND_AUTHOR;
  delete process.env.THREADMIND_ROOT;
  root = await mkdtemp(join(tmpdir(), "threadmind-e2e-"));
  const created = createServer(join(root, ".threadmind"));
  services = created.services;
  client = await connect(created.server);
});

afterEach(async () => {
  await client.close();
  await rm(root, { recursive: true, force: true });
});

async function call(
  name: string,
  args: Record<string, unknown> = {},
  on: Client = client
): Promise<{ text: string; isError: boolean }> {
  const result = await on.callTool({ name, arguments: args });
  const content = result.content as { type: string; text: string }[];
  return {
    text: content.map((c) => c.text).join("\n"),
    isError: result.isError === true,
  };
}

async function promptText(name: string): Promise<string> {
  const { messages } = await client.getPrompt({ name });
  return (messages[0].content as { type: string; text: string }).text;
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

describe("MCP integration", () => {
  it("declares a title and annotations for every tool", async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(14);
    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.annotations?.openWorldHint, tool.name).toBe(false);
    }

    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    for (const name of ["context_get", "thread_list", "project_list", "stats_show"]) {
      expect(byName[name].annotations?.readOnlyHint, name).toBe(true);
    }
    expect(byName["thread_delete"].annotations?.destructiveHint).toBe(true);
    expect(byName["summary_update"].annotations?.destructiveHint).toBe(true);
    expect(byName["thread_merge"].annotations?.destructiveHint).toBe(true);
    expect(byName["thread_create"].annotations?.destructiveHint).toBe(false);
    expect(byName["thread_status"].annotations?.destructiveHint).toBe(false);
  });

  it("sends usage instructions to the client", () => {
    const instructions = client.getInstructions();
    expect(instructions).toContain("call context_get once");
    expect(instructions).toContain("tm:create <title> → thread_create");
  });

  it("tells the model when the workspace has no project", async () => {
    const result = await call("context_get");
    expect(result.isError).toBe(true);
    expect(result.text).toContain("No ThreadMind project in this workspace");
    expect(existsSync(join(root, ".threadmind"))).toBe(false);
  });

  it("points to existing projects when none is active", async () => {
    await call("project_create", { title: "Team App" });
    await call("project_create", { title: "Other" });
    // A teammate's fresh clone: several projects, none selected yet
    const clone = await connect(createServer(join(root, ".threadmind")).server);
    await rm(join(root, ".threadmind", "config.json"));

    const result = await call("thread_list", {}, clone);
    expect(result.text).toContain("No active project. Existing projects:");
    expect(result.text).toContain("team-app");
    expect(result.text).toContain("other");
    await clone.close();
  });

  it("selects the only project after a fresh clone", async () => {
    await call("project_create", { title: "Team App" });
    await rm(join(root, ".threadmind", "config.json"));
    const clone = await connect(createServer(join(root, ".threadmind")).server);

    expect((await call("thread_list", {}, clone)).text).toBe("main ← active");
    await clone.close();
  });

  it("returns the full context when switching threads", async () => {
    const longSummary = `${"JWT with refresh tokens. ".repeat(20)}END`;
    await call("project_create", { title: "Shop" });
    await call("summary_update", { content: "Root decisions." });
    await call("thread_create", { title: "Auth" });
    await call("summary_update", { content: longSummary });
    await call("thread_switch", { threadId: "main" });

    const { text } = await call("thread_switch", { threadId: "auth" });
    expect(text).toContain('Switched to thread "auth".');
    expect(text).toContain("## Thread: Shop\n\nRoot decisions.");
    expect(text).toContain(`## Thread: Auth (active)\n\n${longSummary}`);
  });

  it("embeds results in read-only prompts", async () => {
    await call("project_create", { title: "Shop" });
    await call("summary_update", { content: "Root decisions." });
    await call("thread_create", { title: "Auth" });

    expect(await promptText("tm-tree")).toContain("main\n└── auth ← active");

    const context = await promptText("tm-context");
    expect(context).toContain("Root decisions.");
    expect(await promptText("start-thread")).toBe(context);

    expect(await promptText("tm-stats")).toContain('ThreadMind Stats: "Shop"');
  });

  it("completes thread IDs in prompt arguments and resource URIs", async () => {
    await call("project_create", { title: "Shop" });
    await call("thread_create", { title: "Auth" });
    await call("thread_create", { title: "Auth UI" });
    await call("thread_create", { title: "Billing", parentId: "main" });

    const prompt = await client.complete({
      ref: { type: "ref/prompt", name: "tm-switch" },
      argument: { name: "threadId", value: "au" },
    });
    expect([...prompt.completion.values].sort()).toEqual(["auth", "auth-ui"]);

    const resource = await client.complete({
      ref: { type: "ref/resource", uri: "threadmind://thread/{threadId}" },
      argument: { name: "threadId", value: "b" },
    });
    expect(resource.completion.values).toEqual(["billing"]);
  });

  it("exposes each thread as a resource", async () => {
    await call("project_create", { title: "Shop" });
    await call("thread_create", { title: "Auth" });
    await call("summary_update", { content: "JWT with refresh tokens." });

    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toEqual(
      expect.arrayContaining([
        "threadmind://context",
        "threadmind://tree",
        "threadmind://thread/main",
        "threadmind://thread/auth",
      ])
    );

    const { contents } = await client.readResource({
      uri: "threadmind://thread/auth",
    });
    const text = (contents[0] as { text: string }).text;
    expect(text).toContain("# Auth");
    expect(text).toContain("parent: main");
    expect(text).toContain("JWT with refresh tokens.");

    await expect(
      client.readResource({ uri: "threadmind://thread/ghost" })
    ).rejects.toThrow('Thread "ghost" not found');
  });

  it("notifies the client when the thread list changes", async () => {
    let notifications = 0;
    client.setNotificationHandler(ResourceListChangedNotificationSchema, () => {
      notifications++;
    });

    await call("project_create", { title: "Shop" });
    await call("thread_create", { title: "Auth" });
    await call("summary_update", { content: "No list change." });
    await call("thread_delete", { threadId: "auth" });

    await vi.waitFor(() => expect(notifications).toBe(3));
  });
});

describe("sessions, summaries and git", () => {
  /** Another client session on the same repository. */
  const otherSession = () =>
    connect(createServer(join(root, ".threadmind")).server);

  it("keeps one active thread per session", async () => {
    await call("project_create", { title: "Shop" });
    await call("thread_create", { title: "Auth" });
    await call("thread_create", { title: "Billing", parentId: "main" });

    const other = await otherSession();
    try {
      // The new session starts where the last one left off
      expect((await call("thread_list", {}, other)).text).toContain("billing ← active");

      await call("thread_switch", { threadId: "auth" });

      expect((await call("thread_list", {}, other)).text).toContain("billing ← active");
      expect((await call("thread_list")).text).toContain("auth ← active");
    } finally {
      await other.close();
    }
  });

  it("updates one section and passes on only durable sections", async () => {
    await call("project_create", { title: "Shop" });
    await call("summary_update", {
      content: "## Decisions\n- Next.js\n\n## State\n- Setting up CI",
    });
    await call("thread_create", { title: "Auth" });

    const added = await call("summary_update", {
      content: "- JWT with refresh tokens",
      section: "decisions",
    });
    expect(added.text).toBe('Section "decisions" of the summary updated for thread "auth".');

    const { text } = await call("context_get");
    expect(text).toContain("- Next.js");
    expect(text).not.toContain("Setting up CI");
    expect(text).toContain("## Thread: Auth (active)\n\n## Decisions\n- JWT with refresh tokens");
  });

  it("closes and merges threads", async () => {
    await call("project_create", { title: "Shop" });
    await call("thread_create", { title: "GraphQL" });
    const closed = await call("thread_status", {
      status: "abandoned",
      reason: "REST is enough",
    });
    expect(closed.text).toContain("graphql [abandoned]");

    await call("thread_create", { title: "Auth", parentId: "main" });
    const merged = await call("thread_merge", {
      parentSummary: "## Decisions\n- Auth uses JWT\n- No GraphQL: REST is enough",
    });
    expect(merged.text).toContain('Thread "auth" merged into "main", which is now the active thread.');

    expect((await call("context_get")).text).toContain("- Auth uses JWT");
    const { contents } = await client.readResource({ uri: "threadmind://thread/auth" });
    expect((contents[0] as { text: string }).text).toContain("status: done");
  });

  it("fits the context to a token budget", async () => {
    await call("project_create", { title: "Shop" });
    await call("summary_update", { content: "x".repeat(2000) });
    await call("thread_create", { title: "Auth" });
    await call("summary_update", { content: "Auth summary." });

    const { text } = await call("context_get", { maxTokens: 100 });
    expect(text).toContain("Auth summary.");
    expect(text).toContain("_Left out to fit the token budget: main");
  });

  it("links threads to git branches and flags outdated summaries", async () => {
    git(root, "init", "-q", "-b", "main");
    await commitFile(root, "README.md", "hello");
    await call("project_create", { title: "Shop" });

    git(root, "checkout", "-q", "-b", "feature/auth-ui");
    const created = await call("thread_create", { title: "Auth UI" });
    expect(created.text).toContain('Linked to git branch "feature/auth-ui"');
    await call("summary_update", {
      content: "## Decisions\n- Login form with React Hook Form",
      paths: ["src/auth"],
    });
    await commitFile(root, "src/auth/form.tsx", "v2");

    // A new session on the branch starts on its thread, and sees the change
    const onBranch = await otherSession();
    try {
      const { text } = await call("context_get", {}, onBranch);
      expect(text).toContain("## Thread: Auth UI (active)");
      expect(text).toContain("_⚠ 1 commit changed src/auth since this summary was written");
    } finally {
      await onBranch.close();
    }

    git(root, "checkout", "-q", "main");
    const onMain = await otherSession();
    try {
      expect((await call("thread_list", {}, onMain)).text).toContain("main ← active");
    } finally {
      await onMain.close();
    }
  });
});

describe("workspace resolution", () => {
  const extraDirs: string[] = [];

  async function tempWorkspace(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "threadmind-ws-"));
    extraDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    delete process.env.THREADMIND_ROOT;
    for (const dir of extraDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("stores data in the root advertised by the client", async () => {
    const workspace = await tempWorkspace();
    const rootsClient = await connect(createServer().server, () => [workspace]);

    try {
      await call("project_create", { title: "Rooted" }, rootsClient);
      await call("threadmind_init", { clients: ["agents"] }, rootsClient);

      expect(existsSync(join(workspace, ".threadmind", "projects", "rooted.json"))).toBe(true);
      expect(existsSync(join(workspace, "AGENTS.md"))).toBe(true);
    } finally {
      await rootsClient.close();
    }
  });

  it("prefers a root that already contains ThreadMind data", async () => {
    const empty = await tempWorkspace();
    const existing = await tempWorkspace();
    await mkdir(join(existing, ".threadmind"));
    const rootsClient = await connect(createServer().server, () => [empty, existing]);

    try {
      await call("project_create", { title: "Rooted" }, rootsClient);
      expect(existsSync(join(existing, ".threadmind", "projects", "rooted.json"))).toBe(true);
      expect(existsSync(join(empty, ".threadmind"))).toBe(false);
    } finally {
      await rootsClient.close();
    }
  });

  it("follows the client when its roots change", async () => {
    const first = await tempWorkspace();
    const second = await tempWorkspace();
    let current = first;
    const rootsClient = await connect(createServer().server, () => [current]);

    try {
      await call("project_create", { title: "First" }, rootsClient);
      current = second;
      await rootsClient.sendRootsListChanged();
      await call("project_create", { title: "Second" }, rootsClient);

      expect(existsSync(join(first, ".threadmind", "projects", "first.json"))).toBe(true);
      expect(existsSync(join(second, ".threadmind", "projects", "second.json"))).toBe(true);
    } finally {
      await rootsClient.close();
    }
  });

  it("lets THREADMIND_ROOT override the client's roots", async () => {
    const fromEnv = await tempWorkspace();
    const fromClient = await tempWorkspace();
    process.env.THREADMIND_ROOT = fromEnv;
    const rootsClient = await connect(createServer().server, () => [fromClient]);

    try {
      await call("project_create", { title: "Pinned" }, rootsClient);
      expect(existsSync(join(fromEnv, ".threadmind", "projects", "pinned.json"))).toBe(true);
      expect(existsSync(join(fromClient, ".threadmind"))).toBe(false);
    } finally {
      await rootsClient.close();
    }
  });
});
