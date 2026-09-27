import { describe, it, expect } from "vitest";
import {
  inheritedSummary,
  isStructured,
  updateSection,
} from "../../src/core/summary.js";

const structured = [
  "Auth for the web app.",
  "",
  "## Decisions",
  "- JWT with refresh tokens",
  "",
  "## Constraints",
  "- Sessions survive a restart",
  "",
  "## State",
  "- Login done",
  "",
  "## Open questions",
  "- Rotate refresh tokens?",
  "",
  "## Next steps",
  "- Logout",
].join("\n");

describe("isStructured", () => {
  it("recognizes the section headings, whatever their case", () => {
    expect(isStructured(structured)).toBe(true);
    expect(isStructured("## decisions:\n- x")).toBe(true);
    expect(isStructured("Free text\n## Notes\n- x")).toBe(false);
  });
});

describe("inheritedSummary", () => {
  it("keeps the preamble, decisions and constraints", () => {
    expect(inheritedSummary(structured)).toBe(
      "Auth for the web app.\n\n## Decisions\n- JWT with refresh tokens\n\n## Constraints\n- Sessions survive a restart"
    );
  });

  it("keeps free-form summaries whole", () => {
    const free = "We chose JWT.\nLogin works.";
    expect(inheritedSummary(free)).toBe(free);
  });

  it("recognizes French section titles", () => {
    const french =
      "## Décisions\n- JWT\n\n## Contraintes\n- Redémarrage\n\n## État\n- Connexion faite\n\n## Questions ouvertes\n- Rotation ?\n\n## Prochaines étapes\n- Déconnexion";
    expect(inheritedSummary(french)).toBe("## Décisions\n- JWT\n\n## Contraintes\n- Redémarrage");
    expect(updateSection(french, "state", "- Tout est fait", true)).toContain("## État\n- Tout est fait");
  });

  it("keeps unknown sections", () => {
    expect(inheritedSummary("## Decisions\n- a\n\n## Glossary\n- b\n\n## State\n- c")).toBe(
      "## Decisions\n- a\n\n## Glossary\n- b"
    );
  });

  it("ignores headings inside code fences", () => {
    const content = "## Decisions\n- a\n```md\n## State\nnot a section\n```";
    expect(inheritedSummary(content)).toBe(content);
  });
});

describe("updateSection", () => {
  it("adds to an existing section", () => {
    expect(updateSection("## Decisions\n- a\n\n## State\n- s", "decisions", "- b", false)).toBe(
      "## Decisions\n- a\n- b\n\n## State\n- s"
    );
  });

  it("replaces a section", () => {
    expect(updateSection("## Decisions\n- a\n\n## State\n- old", "state", "- new", true)).toBe(
      "## Decisions\n- a\n\n## State\n- new"
    );
  });

  it("creates a missing section at its place", () => {
    expect(updateSection("## Decisions\n- a\n\n## State\n- s", "constraints", "- c", false)).toBe(
      "## Decisions\n- a\n\n## Constraints\n- c\n\n## State\n- s"
    );
    expect(updateSection("Intro", "next-steps", "- n", false)).toBe(
      "Intro\n\n## Next steps\n- n"
    );
  });

  it("structures an empty summary", () => {
    expect(updateSection("", "decisions", "- a", false)).toBe("## Decisions\n- a");
  });
});
