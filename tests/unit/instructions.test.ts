import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateInstructions } from "../../src/core/instructions.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "threadmind-instr-"));
  // Create .threadmind dir for the generic instructions file
  await mkdir(join(tempDir, ".threadmind"), { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("generateInstructions", () => {
  it("generates all instruction files by default", async () => {
    const result = await generateInstructions({
      projectTitle: "My App",
      basePath: tempDir,
    });

    expect(result.files).toHaveLength(3);

    const clients = result.files.map((f) => f.client).sort();
    expect(clients).toEqual(["claude", "cursor", "generic"]);
  });

  it("generates CLAUDE.md with correct content", async () => {
    await generateInstructions({
      projectTitle: "Test Project",
      basePath: tempDir,
      clients: ["claude"],
    });

    const content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("ThreadMind");
    expect(content).toContain("Test Project");
    expect(content).toContain("context_get");
    expect(content).toContain("summary_update");
    expect(content).toContain("thread_create");
    expect(content).toContain("Claude Code Specifics");
  });

  it("generates .cursorrules with correct content", async () => {
    await generateInstructions({
      projectTitle: "Test Project",
      basePath: tempDir,
      clients: ["cursor"],
    });

    const content = await readFile(join(tempDir, ".cursorrules"), "utf-8");
    expect(content).toContain("ThreadMind");
    expect(content).toContain("Cursor Specifics");
    expect(content).toContain("context_get");
  });

  it("generates generic instructions in .threadmind/", async () => {
    await generateInstructions({
      projectTitle: "Test Project",
      basePath: tempDir,
      clients: ["generic"],
    });

    const content = await readFile(
      join(tempDir, ".threadmind", "instructions.md"),
      "utf-8"
    );
    expect(content).toContain("Any MCP Client");
    expect(content).toContain("context_get");
  });

  it("generates only specified clients", async () => {
    const result = await generateInstructions({
      projectTitle: "My App",
      basePath: tempDir,
      clients: ["claude"],
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].client).toBe("claude");
  });

  it("includes tm: shortcuts in all instruction files", async () => {
    const result = await generateInstructions({
      projectTitle: "My App",
      basePath: tempDir,
    });

    for (const file of result.files) {
      const content = await readFile(file.path, "utf-8");
      expect(content).toContain("tm:help");
      expect(content).toContain("tm:context");
      expect(content).toContain("tm:create");
      expect(content).toContain("tm:switch");
      expect(content).toContain("tm:summary");
      expect(content).toContain("tm:stats");
      expect(content).toContain("tm:tree");
      expect(content).toContain("Quick Shortcuts");
    }
  });

  it("includes project title in all files", async () => {
    const result = await generateInstructions({
      projectTitle: "Special Project Name",
      basePath: tempDir,
    });

    for (const file of result.files) {
      const content = await readFile(file.path, "utf-8");
      expect(content).toContain("Special Project Name");
    }
  });

  it("reports action=created for new files and wraps content in markers", async () => {
    const result = await generateInstructions({
      projectTitle: "My App",
      basePath: tempDir,
      clients: ["claude"],
    });

    expect(result.files[0].action).toBe("created");
    const content = await readFile(join(tempDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("<!-- threadmind:start -->");
    expect(content).toContain("<!-- threadmind:end -->");
  });

  it("updates only the ThreadMind section when markers already exist, preserving user content", async () => {
    const claudePath = join(tempDir, "CLAUDE.md");

    // Pre-populate a CLAUDE.md with user content + ThreadMind markers (old title)
    await writeFile(
      claudePath,
      "# My Project Rules\nKeep code clean.\n\n<!-- threadmind:start -->\n## ThreadMind — Context Management\nProject: \"Old Title\"\n<!-- threadmind:end -->\n",
      "utf-8"
    );

    const result = await generateInstructions({
      projectTitle: "New Title",
      basePath: tempDir,
      clients: ["claude"],
    });

    expect(result.files[0].action).toBe("updated");
    const content = await readFile(claudePath, "utf-8");

    // User content preserved
    expect(content).toContain("# My Project Rules");
    expect(content).toContain("Keep code clean.");

    // ThreadMind section updated with new title
    expect(content).toContain("New Title");
    expect(content).not.toContain("Old Title");

    // Markers still present
    expect(content).toContain("<!-- threadmind:start -->");
    expect(content).toContain("<!-- threadmind:end -->");
  });

  it("appends ThreadMind section when file exists without markers, preserving existing content", async () => {
    const claudePath = join(tempDir, "CLAUDE.md");

    // Pre-populate a CLAUDE.md with only user content (no markers)
    await writeFile(claudePath, "# Existing Rules\nDo not use var.\n", "utf-8");

    const result = await generateInstructions({
      projectTitle: "My App",
      basePath: tempDir,
      clients: ["claude"],
    });

    expect(result.files[0].action).toBe("appended");
    const content = await readFile(claudePath, "utf-8");

    // Original content preserved at the top
    expect(content).toContain("# Existing Rules");
    expect(content).toContain("Do not use var.");

    // ThreadMind section appended
    expect(content).toContain("<!-- threadmind:start -->");
    expect(content).toContain("<!-- threadmind:end -->");
    expect(content).toContain("My App");

    // Original content appears before ThreadMind section
    const markerPos = content.indexOf("<!-- threadmind:start -->");
    const userPos = content.indexOf("# Existing Rules");
    expect(userPos).toBeLessThan(markerPos);
  });
});
