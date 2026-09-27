/**
 * Project and thread IDs are used as file names, so they are restricted to an
 * alphabet that cannot express path separators or relative segments.
 */
export const ID_PATTERN = /^[a-z0-9-]+$/;

export const ID_PATTERN_MESSAGE =
  "IDs may only contain lowercase letters, digits and hyphens";

const MAX_SLUG_LENGTH = 64;

// Letters that Unicode normalization does not decompose into ASCII
const LIGATURES: Record<string, string> = {
  æ: "ae",
  œ: "oe",
  ß: "ss",
  ø: "o",
  ł: "l",
  đ: "d",
};

export function assertValidId(id: string, kind: "project" | "thread"): void {
  if (!ID_PATTERN.test(id)) {
    throw new Error(`Invalid ${kind} ID "${id}": ${ID_PATTERN_MESSAGE}`);
  }
}

/**
 * Derive an ID candidate from a title. Accents are stripped rather than
 * dropped ("Système" → "systeme"). May return an empty string for titles
 * without any Latin letter or digit; callers provide a fallback.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[æœßøłđ]/g, (c) => LIGATURES[c])
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, "");
}

/** Collapse all whitespace (including newlines) so a title fits on one line. */
export function normalizeTitle(title: string): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new Error("Title cannot be empty");
  }
  return normalized;
}
