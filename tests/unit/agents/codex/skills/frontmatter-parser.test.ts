import { describe, expect, it } from "vitest";

import { parseFrontmatter } from "@/features/agents/codex/skills/frontmatter-parser";

describe("parseFrontmatter", () => {
  it("parses valid frontmatter with all fields", () => {
    const content = [
      "---",
      'name: "design-taste-frontend"',
      'description: "Frontend with taste"',
      "aliases:",
      '  - "design-taste"',
      '  - "frontend-taste"',
      "triggers:",
      '  - "ui"',
      "asksClarification: true",
      'clarificationPolicy: "when_ambiguous"',
      "appliesTo:",
      '  - "web"',
      'version: "2.0.0"',
      "---",
      "Body content here.",
      "More body.",
    ].join("\n");

    const result = parseFrontmatter(content);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta.name).toBe("design-taste-frontend");
    expect(result.meta.aliases.length).toBe(2);
    expect(result.meta.clarificationPolicy).toBe("when_ambiguous");
    expect(result.body).toBe("Body content here.\nMore body.");
  });

  it("applies defaults when optional fields are omitted", () => {
    const content = [
      "---",
      'name: "minimal-skill"',
      'description: "Just the essentials"',
      "---",
      "body",
    ].join("\n");

    const result = parseFrontmatter(content);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta.aliases).toEqual([]);
    expect(result.meta.triggers).toEqual([]);
    expect(result.meta.asksClarification).toBe(false);
    expect(result.meta.clarificationPolicy).toBe("never");
    expect(result.meta.appliesTo).toEqual([]);
    expect(result.meta.version).toBe("1.0.0");
  });

  it("returns missing_frontmatter when no leading ---", () => {
    const content = 'name: "no-frontmatter"\nbody content\n';

    const result = parseFrontmatter(content);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("missing_frontmatter");
  });

  it("returns invalid_yaml on malformed YAML", () => {
    const content = [
      "---",
      "name: 'unterminated",
      "description: [oops",
      "---",
      "body",
    ].join("\n");

    const result = parseFrontmatter(content);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_yaml");
  });

  it("returns schema_violation when description is missing", () => {
    const content = ["---", 'name: "no-desc"', "---", "body"].join("\n");

    const result = parseFrontmatter(content);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("schema_violation");
  });

  it("returns schema_violation when name has uppercase letters", () => {
    const content = [
      "---",
      'name: "Bad-NAME"',
      'description: "uppercase forbidden"',
      "---",
      "body",
    ].join("\n");

    const result = parseFrontmatter(content);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("schema_violation");
  });

  it("returns schema_violation for invalid clarificationPolicy", () => {
    const content = [
      "---",
      'name: "weird-policy"',
      'description: "bad enum"',
      'clarificationPolicy: "weird_value"',
      "---",
      "body",
    ].join("\n");

    const result = parseFrontmatter(content);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("schema_violation");
  });

  it("returns unknown_fields when an unknown key is present", () => {
    const content = [
      "---",
      'name: "extra-field"',
      'description: "has unknown"',
      'foo: "bar"',
      "---",
      "body",
    ].join("\n");

    const result = parseFrontmatter(content);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unknown_fields");
    expect(result.detail).toContain("foo");
  });

  it("preserves body containing --- markers further down", () => {
    const bodyContent = [
      "Intro paragraph.",
      "",
      "---",
      "",
      "Section after divider.",
    ].join("\n");
    const content = [
      "---",
      'name: "with-divider"',
      'description: "body has dividers"',
      "---",
      bodyContent,
    ].join("\n");

    const result = parseFrontmatter(content);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe(bodyContent);
  });
});
