import type { ThreadMetadata, ThreadStatus } from "../types/index.js";

// Opening "---" line, optional block, then the first line that is exactly "---"
const FRONTMATTER_BLOCK =
  /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

const STATUSES: readonly ThreadStatus[] = ["active", "done", "abandoned"];

export function parseFrontmatter(raw: string): {
  metadata: ThreadMetadata;
  content: string;
} {
  const text = raw.replace(/^﻿/, "").trimStart();
  if (!text.startsWith("---")) {
    throw new Error("Invalid frontmatter: missing opening ---");
  }

  const match = FRONTMATTER_BLOCK.exec(text);
  if (!match) {
    throw new Error("Invalid frontmatter: missing closing ---");
  }

  const content = text.slice(match[0].length).trim();

  const fields: Record<string, string> = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    fields[key] = value;
  }

  const metadata: ThreadMetadata = {
    id: readValue(fields["id"]),
    title: readValue(fields["title"]),
    parentId:
      fields["parentId"] === undefined || fields["parentId"] === "null"
        ? null
        : readValue(fields["parentId"]),
    author: readValue(fields["author"]),
    createdAt: readValue(fields["createdAt"]),
    updatedAt: readValue(fields["updatedAt"]),
  };

  const status = readValue(fields["status"]) as ThreadStatus;
  if (STATUSES.includes(status) && status !== "active") {
    metadata.status = status;
  }
  for (const key of ["branch", "commit", "mergedInto"] as const) {
    const value = readValue(fields[key]);
    if (value) metadata[key] = value;
  }
  const paths = readList(fields["paths"]);
  if (paths.length > 0) metadata.paths = paths;

  return { metadata, content };
}

export function serializeFrontmatter(
  metadata: ThreadMetadata,
  content: string
): string {
  const lines = [
    "---",
    `id: ${formatValue(metadata.id)}`,
    `title: ${formatValue(metadata.title)}`,
    `parentId: ${metadata.parentId === null ? "null" : formatValue(metadata.parentId)}`,
    `author: ${formatValue(metadata.author)}`,
    `createdAt: ${formatValue(metadata.createdAt)}`,
    `updatedAt: ${formatValue(metadata.updatedAt)}`,
  ];

  // Optional fields are only written when set, so older files stay unchanged
  if (metadata.status && metadata.status !== "active") {
    lines.push(`status: ${metadata.status}`);
  }
  if (metadata.branch) lines.push(`branch: ${formatValue(metadata.branch)}`);
  if (metadata.commit) lines.push(`commit: ${formatValue(metadata.commit)}`);
  if (metadata.paths && metadata.paths.length > 0) {
    lines.push(`paths: ${JSON.stringify(metadata.paths)}`);
  }
  if (metadata.mergedInto) {
    lines.push(`mergedInto: ${formatValue(metadata.mergedInto)}`);
  }

  lines.push("---", "", content);
  return lines.join("\n");
}

/**
 * Plain values are written as-is to keep files readable. Anything that YAML
 * or this line-based parser could misread (line breaks, "key: value"
 * lookalikes, leading indicators, reserved words) is written as a JSON
 * string, which is also a valid YAML double-quoted scalar.
 */
function formatValue(value: string): string {
  const needsQuotes =
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(value) ||
    /: | #|:$/.test(value) ||
    /^(null|true|false|~)$/i.test(value);
  return needsQuotes ? JSON.stringify(value) : value;
}

function readValue(raw: string | undefined): string {
  if (raw === undefined) return "";
  if (raw.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "string") return parsed;
    } catch {
      // Not a JSON string: keep the raw text
    }
  } else if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1).replace(/''/g, "'");
  }
  return raw;
}

/** Read a JSON array of strings (a valid YAML flow sequence). */
function readList(raw: string | undefined): string[] {
  if (!raw?.startsWith("[")) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
