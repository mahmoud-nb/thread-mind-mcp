#!/usr/bin/env node
// Packs a skill folder (skills/<name>/) into skills/dist/<name>.zip, the
// archive skill marketplaces such as Agensi expect: a single top-level folder
// named after the skill, SKILL.md at its root, text files only.
// Usage: node scripts/pack-skill.mjs [skill-name] [output.zip]
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { deflateRawSync } from "node:zlib";

const name = process.argv[2] ?? "thread-mind";
const skillDir = join("skills", name);
const output = process.argv[3] ?? join("skills", "dist", `${name}.zip`);

// Files operating systems and editors leave behind
const IGNORED = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

const skill = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
const declared = /^---\r?\n[\s\S]*?^name:\s*(\S+)\s*$/m.exec(skill)?.[1];
if (declared !== name) {
  throw new Error(`SKILL.md declares name "${declared}", but the folder is "${name}"`);
}

const files = listFiles(skillDir).filter((file) => !IGNORED.has(basename(file)));
const entries = [];
const directories = new Set([name]);
for (const file of files) {
  const raw = readFileSync(file);
  if (!isText(raw)) throw new Error(`${file} is not a text file`);
  // Same archive from a Windows checkout (CRLF) as from any other
  const data = Buffer.from(raw.toString("utf-8").replace(/\r\n/g, "\n"), "utf-8");

  const path = [name, ...relative(skillDir, file).split(sep)].join("/");
  for (let dir = dirname(path); dir !== "."; dir = dirname(dir)) directories.add(dir);
  entries.push({ path, data });
}

const archive = zip([
  ...[...directories].sort().map((dir) => ({ path: `${dir}/`, data: Buffer.alloc(0) })),
  ...entries.sort((a, b) => a.path.localeCompare(b.path)),
]);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, archive);
console.log(`${output}: ${entries.length} files`);
for (const { path } of entries) console.log(`  ${path}`);

function listFiles(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const path = join(dir, entry);
      const stats = statSync(path);
      if (stats.isDirectory()) return listFiles(path);
      if (stats.isFile()) return [path];
      throw new Error(`${path} is neither a file nor a directory`);
    });
}

/** Valid UTF-8 text without NUL bytes. */
function isText(data) {
  if (data.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(data);
    return true;
  } catch {
    return false;
  }
}

/** A ZIP archive with deflated files, forward slashes and a fixed timestamp. */
function zip(items) {
  // 2026-01-01 00:00, so that the same files give the same archive
  const time = 0;
  const date = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { path, data } of items) {
    const name = Buffer.from(path, "utf-8");
    const isDir = path.endsWith("/");
    const body = isDir ? data : deflateRawSync(data);
    const method = isDir ? 0 : 8;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4); // made by: Unix, ZIP 3.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    // Unix permissions: 755 directories, 644 files
    central.writeUInt32LE((((isDir ? 0o40755 : 0o100644) << 16) | (isDir ? 0x10 : 0)) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(items.length, 8);
  end.writeUInt16LE(items.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
