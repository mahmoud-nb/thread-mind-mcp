import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, mkdir } from "node:fs/promises";
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
});
