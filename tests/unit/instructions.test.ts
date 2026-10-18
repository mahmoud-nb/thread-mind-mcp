import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CLIENT_TARGETS,
  generateInstructions,
  serverInstructions,
} from "../../src/core/instructions.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "threadmind-instr-"));
  // Create .threadmind dir for the generic instructions file
  await mkdir(join(tempDir, ".threadmind"), { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("serverInstructions", () => {
  it("describes the workflow and every shortcut", () => {
    const text = serverInstructions();
    for (const tool of ["context_get", "summary_update", "thread_list", "thread_switch", "thread_create"]) {
      expect(text).toContain(tool);
    }
    for (const shortcut of ["tm:context", "tm:tree", "tm:create", "tm:switch", "tm:summary", "tm:stats", "tm:help"]) {
      expect(text).toContain(shortcut);
    }
  });

  it("stays shorter than the former CLAUDE.md section", () => {
    // The former generated section weighed about 3,100 characters
    expect(serverInstructions().length).toBeLessThan(2500);
  });
});

describe("generateInstructions", () => {
  it("generates AGENTS.md and the generic file by default", async () => {
    const result = await generateInstructions({
      projectTitle: "My App",
      basePath: tempDir,
    });

    expect(result.files.map((f) => f.client)).toEqual(["agents", "generic"]);
    expect(existsSync(join(tempDir, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(tempDir, "CLAUDE.md"))).toBe(false);
    expect(result.notes).toEqual([]);
  });

  it("reuses the MCP server instructions", async () => {
    await generateInstructions({
      projectTitle: "Test Project",
      basePath: tempDir,
      clients: ["agents"],
    });

    const content = await readFile(join(tempDir, "AGENTS.md"), "utf-8");
    expect(content).toContain('project: "Test Project"');
    expect(content).toContain(serverInstructions());
  });

  it("generates CLAUDE.md on request", async () => {
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
  });

  it("generates an always-applied Cursor rule", async () => {
    const result = await generateInstructions({
      projectTitle: "Test Project",
      basePath: tempDir,
      clients: ["cursor"],
    });

    const rulePath = join(tempDir, ".cursor", "rules", "threadmind.mdc");
    expect(result.files).toEqual([
      { path: rulePath, client: "cursor", action: "created" },
    ]);
    const content = await readFile(rulePath, "utf-8");
    expect(content.startsWith("---\ndescription: ThreadMind")).toBe(true);
    expect(content).toContain("alwaysApply: true");
    expect(content).toContain("context_get");
    expect(content).not.toContain("<!-- threadmind:start -->");

    const again = await generateInstructions({
      projectTitle: "Test Project",
      basePath: tempDir,
      clients: ["cursor"],
    });
    expect(again.files[0].action).toBe("updated");
  });

  it("warns that Cursor would load both AGENTS.md and its rule", async () => {
    const both = await generateInstructions({
      projectTitle: "Test Project",
      basePath: tempDir,
      clients: ["agents", "cursor"],
    });
    expect(both.notes).toEqual([
      expect.stringContaining("Cursor reads AGENTS.md as well as its rules"),
    ]);

    // Also when AGENTS.md was generated earlier
    const later = await generateInstructions({
      projectTitle: "Test Project",
      basePath: tempDir,
      clients: ["cursor"],
    });
    expect(later.notes).toHaveLength(1);
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

  it("includes tm: shortcuts and the project title in all instruction files", async () => {
    const result = await generateInstructions({
      projectTitle: "Special Project Name",
      basePath: tempDir,
      clients: [...CLIENT_TARGETS],
    });

    expect(result.files).toHaveLength(CLIENT_TARGETS.length);
    for (const file of result.files) {
      const content = await readFile(file.path, "utf-8");
      expect(content).toContain("Special Project Name");
      for (const shortcut of ["tm:help", "tm:context", "tm:create", "tm:switch", "tm:summary", "tm:stats", "tm:tree"]) {
        expect(content).toContain(shortcut);
      }
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

  it("refuses to touch a file whose end marker was removed", async () => {
    const claudePath = join(tempDir, "CLAUDE.md");
    const original =
      "# Rules\n<!-- threadmind:start -->\nold section\n# My own notes\n";
    await writeFile(claudePath, original, "utf-8");

    await expect(
      generateInstructions({
        projectTitle: "My App",
        basePath: tempDir,
        clients: ["claude"],
      })
    ).rejects.toThrow("without a matching <!-- threadmind:end -->");

    expect(await readFile(claudePath, "utf-8")).toBe(original);
  });

  describe("files written by earlier versions", () => {
    const section =
      "<!-- threadmind:start -->\n## ThreadMind — Context Management\nold\n<!-- threadmind:end -->";

    it("moves the Cursor section out of the legacy .cursorrules", async () => {
      const legacyPath = join(tempDir, ".cursorrules");
      await writeFile(legacyPath, `# Team rules\nUse tabs.\n\n${section}\n`, "utf-8");

      const result = await generateInstructions({
        projectTitle: "My App",
        basePath: tempDir,
        clients: ["cursor"],
      });

      expect(await readFile(legacyPath, "utf-8")).toBe("# Team rules\nUse tabs.\n");
      expect(result.notes).toHaveLength(1);
      expect(result.notes[0]).toContain(".cursorrules");
    });

    it("deletes .cursorrules when it only held the ThreadMind section", async () => {
      const legacyPath = join(tempDir, ".cursorrules");
      await writeFile(legacyPath, `${section}\n`, "utf-8");

      await generateInstructions({
        projectTitle: "My App",
        basePath: tempDir,
        clients: ["cursor"],
      });

      expect(existsSync(legacyPath)).toBe(false);
    });

    it("only reports leftovers for targets that were not requested", async () => {
      const claudeOriginal = `# Rules\n\n${section}\n`;
      await writeFile(join(tempDir, "CLAUDE.md"), claudeOriginal, "utf-8");
      await writeFile(join(tempDir, ".cursorrules"), `${section}\n`, "utf-8");

      const result = await generateInstructions({
        projectTitle: "My App",
        basePath: tempDir,
      });

      expect(result.notes).toHaveLength(2);
      expect(result.notes.join("\n")).toContain("CLAUDE.md");
      expect(result.notes.join("\n")).toContain(".cursorrules");
      expect(await readFile(join(tempDir, "CLAUDE.md"), "utf-8")).toBe(claudeOriginal);
      expect(existsSync(join(tempDir, ".cursorrules"))).toBe(true);
    });
  });
});
