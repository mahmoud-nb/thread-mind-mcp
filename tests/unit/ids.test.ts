import { describe, it, expect } from "vitest";
import {
  assertValidId,
  normalizeTitle,
  slugify,
} from "../../src/core/ids.js";

describe("slugify", () => {
  it.each([
    ["My App", "my-app"],
    ["Auth System v2", "auth-system-v2"],
    ["API (REST)", "api-rest"],
    ["  Spaces & Symbols!! ", "spaces-symbols"],
    ["snake_case_title", "snake-case-title"],
  ])("slugifies %j as %j", (title, expected) => {
    expect(slugify(title)).toBe(expected);
  });

  it("strips accents instead of dropping letters", () => {
    expect(slugify("Système d'authentification")).toBe(
      "systeme-dauthentification"
    );
    expect(slugify("Cœur métier")).toBe("coeur-metier");
    expect(slugify("Straße")).toBe("strasse");
  });

  it("returns an empty string when no Latin letter or digit remains", () => {
    expect(slugify("认证模块")).toBe("");
    expect(slugify("مصادقة")).toBe("");
    expect(slugify("---")).toBe("");
  });

  it("caps the length without leaving a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(63)} b`);
    expect(slug.length).toBeLessThanOrEqual(64);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("assertValidId", () => {
  it.each(["main", "auth-ui", "feature-2", "2024"])("accepts %j", (id) => {
    expect(() => assertValidId(id, "thread")).not.toThrow();
  });

  it.each([
    "",
    "../../../docs/index",
    "..\\..\\evil",
    "a/b",
    "Auth",
    "a.b",
    "with space",
  ])("rejects %j", (id) => {
    expect(() => assertValidId(id, "thread")).toThrow('Invalid thread ID');
  });
});

describe("normalizeTitle", () => {
  it("collapses whitespace and line breaks", () => {
    expect(normalizeTitle("  Innocent\nid: evil \r\n title ")).toBe(
      "Innocent id: evil title"
    );
  });

  it("rejects blank titles", () => {
    expect(() => normalizeTitle(" \n\t ")).toThrow("Title cannot be empty");
  });
});
