import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../src/server.js";
import { SHORTCUTS } from "../../src/core/instructions.js";

// Checks the agent skill published on skill marketplaces such as Agensi
const repo = fileURLToPath(new URL("../..", import.meta.url));
const skillDir = join(repo, "skills", "thread-mind");
const read = (path: string) => readFileSync(join(skillDir, path), "utf-8");
const skill = read("SKILL.md");

function frontmatter(): Record<string, string> {
  const block = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(skill)?.[1] ?? "";
  return Object.fromEntries(
    block.split(/\r?\n/).map((line) => {
      const colon = line.indexOf(":");
      return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
    })
  );
}

/** Names of the entries of a ZIP archive, read from its central directory. */
function zipEntries(archive: Buffer): string[] {
  const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = archive.readUInt16LE(end + 10);
  let offset = archive.readUInt32LE(end + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const nameLength = archive.readUInt16LE(offset + 28);
    const extra = archive.readUInt16LE(offset + 30);
    const comment = archive.readUInt16LE(offset + 32);
    names.push(archive.toString("utf-8", offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extra + comment;
  }
  return names;
}

const temp = mkdtempSync(join(tmpdir(), "threadmind-skill-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

describe("ThreadMind skill", () => {
  it("has the frontmatter the SKILL.md standard requires", () => {
    const fields = frontmatter();
    expect(fields.name).toBe("thread-mind");
    expect(fields.name).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(fields.description.length).toBeLessThanOrEqual(1024);
    expect(fields.description).toContain("Use when the user asks to");
    expect(fields.compatibility.length).toBeLessThanOrEqual(500);
  });

  it("teaches every shortcut the server knows", () => {
    for (const [shortcut] of SHORTCUTS) {
      expect(skill, shortcut).toContain(`\`${shortcut}\``);
    }
  });

  it("documents every tool the server exposes", async () => {
    const root = mkdtempSync(join(tmpdir(), "threadmind-skill-server-"));
    const client = new Client({ name: "skill-test", version: "0.0.0" });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    try {
      await Promise.all([
        createServer(join(root, ".threadmind")).server.connect(serverTransport),
        client.connect(clientTransport),
      ]);
      const { tools } = await client.listTools();
      const reference = read("references/tools.md");
      for (const { name } of tools) {
        expect(reference, name).toContain(`\`${name}\``);
      }
    } finally {
      await client.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("links only to files it contains", () => {
    const files = readdirSync(join(skillDir, "references"));
    for (const [, target] of skill.matchAll(/\]\((references\/[^)]+)\)/g)) {
      expect(files, target).toContain(target.replace("references/", ""));
    }
  });

  it("packs into one top-level folder with SKILL.md at its root", () => {
    const output = join(temp, "thread-mind.zip");
    execFileSync(process.execPath, ["scripts/pack-skill.mjs", "thread-mind", output], {
      cwd: repo,
    });

    const entries = zipEntries(readFileSync(output));
    expect(entries).toContain("thread-mind/SKILL.md");
    expect(entries).toContain("thread-mind/README.md");
    for (const entry of entries) {
      expect(entry.startsWith("thread-mind/"), entry).toBe(true);
      expect(entry, entry).not.toContain("\\");
    }
  });
});
