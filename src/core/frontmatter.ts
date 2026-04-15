import type { ThreadMetadata } from "../types/index.js";

export function parseFrontmatter(raw: string): {
  metadata: ThreadMetadata;
  content: string;
} {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("---")) {
    throw new Error("Invalid frontmatter: missing opening ---");
  }

  const endIndex = trimmed.indexOf("---", 3);
  if (endIndex === -1) {
    throw new Error("Invalid frontmatter: missing closing ---");
  }

  const frontmatterBlock = trimmed.slice(3, endIndex).trim();
  const content = trimmed.slice(endIndex + 3).trim();

  const metadata: Record<string, string> = {};
  for (const line of frontmatterBlock.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    metadata[key] = value;
  }

  return {
    metadata: {
      id: metadata["id"] ?? "",
      title: metadata["title"] ?? "",
      parentId: metadata["parentId"] === "null" ? null : (metadata["parentId"] ?? null),
      author: metadata["author"] ?? "",
      createdAt: metadata["createdAt"] ?? "",
      updatedAt: metadata["updatedAt"] ?? "",
    },
    content,
  };
}

export function serializeFrontmatter(
  metadata: ThreadMetadata,
  content: string
): string {
  const lines = [
    "---",
    `id: ${metadata.id}`,
    `title: ${metadata.title}`,
    `parentId: ${metadata.parentId ?? "null"}`,
    `author: ${metadata.author}`,
    `createdAt: ${metadata.createdAt}`,
    `updatedAt: ${metadata.updatedAt}`,
    "---",
    "",
    content,
  ];
  return lines.join("\n");
}
