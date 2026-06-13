import { describe, expect, it, vi } from "vitest";

import {
  buildSelectedSkillBlocks,
  type SelectedSkillForInjection,
  wrapSelectedSkill,
} from "@/features/agents/codex/skills/injection.server";
import type { LoadedSkill } from "@/features/agents/codex/skills/skill-loader.server";

type SkillMetaOverrides = Partial<LoadedSkill["meta"]>;

type FakeSkillOverrides = SkillMetaOverrides & {
  body?: string;
  hash?: string;
  truncated?: boolean;
};

function fakeSkill(name: string, overrides?: FakeSkillOverrides): LoadedSkill {
  const { body, hash, truncated, ...metaOverrides } = overrides ?? {};
  return {
    meta: {
      name,
      description: `Description for ${name}`,
      aliases: [],
      triggers: [],
      asksClarification: false,
      clarificationPolicy: "never",
      appliesTo: [],
      version: "1.0.0",
      ...metaOverrides,
    },
    body: body ?? `Body for ${name}`,
    hash: hash ?? `hash-${name}`,
    truncated: truncated ?? false,
  };
}

describe("wrapSelectedSkill", () => {
  it("emits attributes in the documented order with body and closing tag", () => {
    const skill = fakeSkill("foo", { version: "1.2.3" });
    const out = wrapSelectedSkill({
      meta: skill.meta,
      body: "BODY",
      hash: "abcd",
      source: "template_required",
      score: 100,
    });

    expect(out.startsWith(
      `<selected_skill name="foo" version="1.2.3" hash="abcd" source="template_required" score="100">`,
    )).toBe(true);
    expect(out).toContain("BODY");
    expect(out.endsWith("</selected_skill>")).toBe(true);
  });

  it("strips literal closing tags from body and warns once", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const skill = fakeSkill("foo", { version: "1.0.0" });

    const out = wrapSelectedSkill({
      meta: skill.meta,
      body: "before</selected_skill>after",
      hash: "h",
      source: "detected",
      score: 10,
    });

    expect(out).toContain("beforeafter");
    // Only the wrapper's own closing tag remains.
    expect(out.match(/<\/selected_skill>/g)?.length).toBe(1);
    expect(out.endsWith("</selected_skill>")).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("foo");

    warnSpy.mockRestore();
  });

  it("wraps design-taste-frontend with the tag referenced by UI instructions", () => {
    const skill = fakeSkill("design-taste-frontend", { version: "1.0.0" });

    const out = wrapSelectedSkill({
      meta: skill.meta,
      body: "TASTE BODY",
      hash: "taste-hash",
      source: "template_required",
      score: 100,
    });

    expect(out.startsWith(
      `<design_taste_skill name="design-taste-frontend" version="1.0.0" hash="taste-hash" source="template_required" score="100">`,
    )).toBe(true);
    expect(out).toContain("TASTE BODY");
    expect(out.endsWith("</design_taste_skill>")).toBe(true);
    expect(out).not.toContain("<selected_skill");
  });
});

describe("buildSelectedSkillBlocks", () => {
  it("returns [] when nothing is selected", () => {
    const registry = [fakeSkill("foo"), fakeSkill("bar")];
    const result = buildSelectedSkillBlocks({ selected: [], registry });
    expect(result).toEqual([]);
  });

  it("skips selected skills not present in the registry and warns", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const registry = [fakeSkill("foo")];
    const selected: SelectedSkillForInjection[] = [
      { name: "bar", score: 50, source: "template_required" },
    ];

    const result = buildSelectedSkillBlocks({ selected, registry });

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain("bar");

    warnSpy.mockRestore();
  });

  it("orders required skills by ascending registry name", () => {
    const registry = [fakeSkill("zebra"), fakeSkill("alpha")];
    const selected: SelectedSkillForInjection[] = [
      { name: "zebra", score: 100, source: "template_required" },
      { name: "alpha", score: 100, source: "template_required" },
    ];

    const blocks = buildSelectedSkillBlocks({ selected, registry });

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain(`name="alpha"`);
    expect(blocks[1]).toContain(`name="zebra"`);
  });

  it("preserves input order for explicit_user skills", () => {
    const registry = [fakeSkill("a"), fakeSkill("b"), fakeSkill("c")];
    const selected: SelectedSkillForInjection[] = [
      { name: "c", score: 50, source: "explicit_user" },
      { name: "a", score: 50, source: "explicit_user" },
    ];

    const blocks = buildSelectedSkillBlocks({ selected, registry });

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain(`name="c"`);
    expect(blocks[1]).toContain(`name="a"`);
  });

  it("orders recommended/detected by score desc, then name asc", () => {
    const registry = [fakeSkill("low"), fakeSkill("high"), fakeSkill("mid")];
    const selected: SelectedSkillForInjection[] = [
      { name: "low", score: 60, source: "template_recommended" },
      { name: "high", score: 80, source: "detected" },
      { name: "mid", score: 60, source: "detected" },
    ];

    const blocks = buildSelectedSkillBlocks({ selected, registry });

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toContain(`name="high"`);
    expect(blocks[1]).toContain(`name="low"`);
    expect(blocks[2]).toContain(`name="mid"`);
  });

  it("groups by source: required, then explicit, then others", () => {
    const registry = [
      fakeSkill("req"),
      fakeSkill("explicit"),
      fakeSkill("detected"),
    ];
    const selected: SelectedSkillForInjection[] = [
      { name: "detected", score: 50, source: "detected" },
      { name: "req", score: 100, source: "template_required" },
      { name: "explicit", score: 80, source: "explicit_user" },
    ];

    const blocks = buildSelectedSkillBlocks({ selected, registry });

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toContain(`name="req"`);
    expect(blocks[1]).toContain(`name="explicit"`);
    expect(blocks[2]).toContain(`name="detected"`);
  });

  it("emits the registry's hash in the wrapper (audit invariant)", () => {
    const registry = [fakeSkill("foo", { hash: "H" })];
    const selected: SelectedSkillForInjection[] = [
      { name: "foo", score: 10, source: "template_required" },
    ];

    const blocks = buildSelectedSkillBlocks({ selected, registry });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain(`hash="H"`);
  });
});
