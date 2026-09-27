import type { SummarySection } from "../types/index.js";

/** Section headings of a structured summary, in their canonical order. */
export const SECTION_TITLES: Record<SummarySection, string> = {
  decisions: "Decisions",
  constraints: "Constraints",
  state: "State",
  "open-questions": "Open questions",
  "next-steps": "Next steps",
};

export const SECTIONS = [
  "decisions",
  "constraints",
  "state",
  "open-questions",
  "next-steps",
] as const satisfies readonly SummarySection[];

/** Sections that only matter to the thread itself, not to its descendants. */
const THREAD_ONLY: readonly SummarySection[] = ["state", "open-questions", "next-steps"];

interface Block {
  /** Known section, or null for the preamble and unknown headings */
  section: SummarySection | null;
  /** The "## ..." line, or null for the text before the first heading */
  heading: string | null;
  body: string;
}

/** Other titles recognized for each section, accents removed. */
const SECTION_ALIASES: Record<SummarySection, string[]> = {
  decisions: [],
  constraints: ["contraintes"],
  state: ["etat"],
  "open-questions": ["questions ouvertes"],
  "next-steps": ["prochaines etapes"],
};

function sectionOf(heading: string): SummarySection | null {
  const title = heading
    .replace(/^##\s+/, "")
    .replace(/:\s*$/, "")
    .trim()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return (
    SECTIONS.find(
      (s) =>
        SECTION_TITLES[s].toLowerCase() === title ||
        SECTION_ALIASES[s].includes(title)
    ) ?? null
  );
}

/** Split a summary on its "## " headings, ignoring headings inside code fences. */
function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [{ section: null, heading: null, body: "" }];
  let inFence = false;

  for (const line of content.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence && /^##\s+\S/.test(line)) {
      blocks.push({ section: sectionOf(line), heading: line.trim(), body: "" });
      continue;
    }
    const current = blocks[blocks.length - 1];
    current.body += current.body ? `\n${line}` : line;
  }
  return blocks;
}

function renderBlocks(blocks: Block[]): string {
  return blocks
    .map((b) => {
      const body = b.body.trim();
      if (b.heading === null) return body;
      return body ? `${b.heading}\n${body}` : b.heading;
    })
    .filter((text) => text.length > 0)
    .join("\n\n");
}

export function isStructured(content: string): boolean {
  return parseBlocks(content).some((b) => b.section !== null);
}

/**
 * The part of a summary that descendants inherit: everything but the State,
 * Open questions and Next steps sections. Free-form summaries are inherited
 * whole.
 */
export function inheritedSummary(content: string): string {
  const blocks = parseBlocks(content);
  if (!blocks.some((b) => b.section !== null)) return content;
  return renderBlocks(
    blocks.filter((b) => b.section === null || !THREAD_ONLY.includes(b.section))
  );
}

/**
 * Append text to one section of a summary, or replace that section. A missing
 * section is created at its place in the canonical order.
 */
export function updateSection(
  content: string,
  section: SummarySection,
  text: string,
  replace: boolean
): string {
  const blocks = parseBlocks(content);
  const addition = text.trim();
  const existing = blocks.find((b) => b.section === section);

  if (existing) {
    const body = existing.body.trim();
    existing.body = replace || !body ? addition : `${body}\n${addition}`;
    return renderBlocks(blocks);
  }

  const block: Block = {
    section,
    heading: `## ${SECTION_TITLES[section]}`,
    body: addition,
  };
  const order = SECTIONS.indexOf(section);
  const next = blocks.findIndex(
    (b) => b.section !== null && SECTIONS.indexOf(b.section) > order
  );
  if (next === -1) {
    blocks.push(block);
  } else {
    blocks.splice(next, 0, block);
  }
  return renderBlocks(blocks);
}
