import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  detectSkills,
  type DetectorInput,
} from "@/features/agents/codex/skills/detector.server";
import type { LoadedSkill } from "@/features/agents/codex/skills/skill-loader.server";

type SkillMetaOverrides = Partial<LoadedSkill["meta"]>;

function fakeSkill(
  name: string,
  overrides: { meta?: SkillMetaOverrides } & Partial<
    Omit<LoadedSkill, "meta">
  > = {},
): LoadedSkill {
  const { meta: metaOverrides, ...rest } = overrides;
  return {
    meta: {
      name,
      description: "",
      aliases: [],
      triggers: [],
      appliesTo: [],
      asksClarification: false,
      clarificationPolicy: "never",
      version: "1.0.0",
      ...metaOverrides,
    },
    body: "",
    hash: "",
    truncated: false,
    ...rest,
  };
}

function baseInput(overrides: Partial<DetectorInput> = {}): DetectorInput {
  return {
    prompt: "",
    registry: [],
    templateRequired: new Set<string>(),
    templateRecommended: new Set<string>(),
    contextLabels: [],
    maxSelected: 3,
    llmTieBreakGap: 10,
    ...overrides,
  };
}

describe("detectSkills", () => {
  it("scores all skills as 0 when prompt and templates are empty", () => {
    const a = fakeSkill("alpha");
    const b = fakeSkill("bravo");
    const out = detectSkills(
      baseInput({ registry: [a, b] }),
    );

    expect(out.picked).toEqual([]);
    expect(out.metadataOnly).toEqual([]);
    expect(out.candidates).toEqual([]);
    expect(out.ignored).toHaveLength(2);
    for (const entry of out.ignored) {
      expect(entry.score).toBe(0);
    }
    expect(out.ignored.map((e) => e.name).sort()).toEqual(["alpha", "bravo"]);
  });

  it("scores a template-required skill at 100 with source 'template_required'", () => {
    const foo = fakeSkill("foo");
    const out = detectSkills(
      baseInput({
        registry: [foo],
        templateRequired: new Set(["foo"]),
      }),
    );

    expect(out.picked).toHaveLength(1);
    const [entry] = out.picked;
    expect(entry.name).toBe("foo");
    expect(entry.score).toBe(100);
    expect(entry.sources.map((s) => s.source)).toContain("template_required");
  });

  it("matches an explicit user mention by name as a whole word, case-insensitive (score 80)", () => {
    const foo = fakeSkill("foo");
    const out = detectSkills(
      baseInput({
        registry: [foo],
        prompt: "I want the FOO skill",
      }),
    );

    expect(out.picked).toHaveLength(1);
    const [entry] = out.picked;
    expect(entry.name).toBe("foo");
    expect(entry.score).toBe(80);
    expect(entry.sources.map((s) => s.source)).toContain("explicit_user");
  });

  it("matches an explicit mention by alias (score 80)", () => {
    const foo = fakeSkill("foo", { meta: { aliases: ["taste"] } });
    const out = detectSkills(
      baseInput({
        registry: [foo],
        prompt: "apply the taste skill",
      }),
    );

    expect(out.picked).toHaveLength(1);
    expect(out.picked[0].score).toBe(80);
    expect(out.picked[0].sources.map((s) => s.source)).toContain(
      "explicit_user",
    );
  });

  it("does NOT match when the skill name appears only as a substring", () => {
    const foo = fakeSkill("foo");
    const out = detectSkills(
      baseInput({
        registry: [foo],
        prompt: "footwear is great",
      }),
    );

    expect(out.picked).toEqual([]);
    expect(out.candidates).toEqual([]);
    expect(out.metadataOnly).toEqual([]);
    expect(out.ignored).toHaveLength(1);
    expect(out.ignored[0].score).toBe(0);
  });

  it("adds 25 from a trigger phrase match; below 30 stays in 'ignored'", () => {
    const foo = fakeSkill("foo", { meta: { triggers: ["premium UI"] } });
    const out = detectSkills(
      baseInput({
        registry: [foo],
        prompt: "make it a premium UI redesign",
      }),
    );

    expect(out.ignored).toHaveLength(1);
    expect(out.ignored[0].name).toBe("foo");
    expect(out.ignored[0].score).toBe(25);
  });

  it("combines trigger match (25) with template_recommended (60) to land in 'picked' at 85", () => {
    const foo = fakeSkill("foo", { meta: { triggers: ["premium UI"] } });
    const out = detectSkills(
      baseInput({
        registry: [foo],
        prompt: "make it a premium UI redesign",
        templateRecommended: new Set(["foo"]),
      }),
    );

    expect(out.picked).toHaveLength(1);
    expect(out.picked[0].score).toBe(85);
    const sources = out.picked[0].sources.map((s) => s.source);
    expect(sources).toContain("template_recommended");
    expect(sources).toContain("detected");
  });

  it("awards +15 description-cluster bonus when 2 distinct keywords match", () => {
    const foo = fakeSkill("foo", {
      meta: { description: "antislop frontend redesign storefront" },
    });
    const out = detectSkills(
      baseInput({
        registry: [foo],
        prompt: "redesign the storefront",
        templateRecommended: new Set(["foo"]),
      }),
    );

    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0].score).toBe(75);
    expect(out.candidates[0].sources.map((s) => s.source)).toContain(
      "template_recommended",
    );
  });

  it("does NOT award the description-cluster bonus when only 1 distinct keyword matches", () => {
    const foo = fakeSkill("foo", {
      meta: { description: "antislop frontend storefront" },
    });
    const out = detectSkills(
      baseInput({
        registry: [foo],
        prompt: "please redesign things",
        templateRecommended: new Set(["foo"]),
      }),
    );

    // template_recommended (60) only — no +15 cluster bonus
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0].score).toBe(60);
  });

  it("adds +10 when an appliesTo label matches a context label", () => {
    const foo = fakeSkill("foo", { meta: { appliesTo: ["init_project"] } });
    const out = detectSkills(
      baseInput({
        registry: [foo],
        contextLabels: ["init_project"],
      }),
    );

    expect(out.ignored).toHaveLength(1);
    expect(out.ignored[0].score).toBe(10);
  });

  it("places skills into bands by score (>=80 picked, >=50 candidates, >=30 metadataOnly, else ignored)", () => {
    // Build 4 skills with target scores 100, 70, 45, 20 using template + trigger combos.
    const s100 = fakeSkill("a-required");
    const s70 = fakeSkill("b-cluster", {
      meta: { description: "redesign storefront" },
    });
    const s45 = fakeSkill("c-trigger-applies", {
      meta: {
        triggers: ["premium UI"],
        appliesTo: ["init_project"],
      },
    });
    const s20 = fakeSkill("d-applies", {
      meta: { appliesTo: ["init_project"] },
    });
    // s20 needs score 20 — applies_to gives 10. Add a second source worth 10? None exists.
    // Adjust: drop s20 to a clean 0 by removing applies_to and verify <30 → ignored either way.
    // Re-plan: use s20 = score 25 via trigger only (still <30 → ignored, satisfies the band test).
    const s20b = fakeSkill("d-trigger", {
      meta: { triggers: ["premium UI"] },
    });

    const out = detectSkills(
      baseInput({
        registry: [s100, s70, s45, s20b],
        prompt: "redesign storefront with premium UI",
        templateRequired: new Set(["a-required"]),
        templateRecommended: new Set(["b-cluster"]),
        contextLabels: ["init_project"],
        maxSelected: 3,
      }),
    );

    // s100: required = 100
    // s70: template_recommended (60) + cluster (15) = 75
    // s45: trigger (25) + applies_to (10) = 35
    // s20b: trigger (25) = 25
    expect(out.picked.map((e) => e.name)).toEqual(["a-required"]);
    expect(out.candidates.map((e) => e.name)).toEqual(["b-cluster"]);
    expect(out.metadataOnly.map((e) => e.name)).toEqual(["c-trigger-applies"]);
    expect(out.ignored.map((e) => e.name)).toEqual(["d-trigger"]);
  });

  it("includes ALL required skills in 'picked' even when their count exceeds maxSelected (and warns)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = fakeSkill("alpha");
    const b = fakeSkill("bravo");
    const c = fakeSkill("charlie");
    const out = detectSkills(
      baseInput({
        registry: [a, b, c],
        templateRequired: new Set(["alpha", "bravo", "charlie"]),
        maxSelected: 2,
      }),
    );

    expect(out.picked.map((e) => e.name).sort()).toEqual([
      "alpha",
      "bravo",
      "charlie",
    ]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does NOT promote non-required auto-include skills past the cap", () => {
    // 4 auto-include scores via explicit mention (80) and template_required (100).
    // Build prompts so each scores in the range [80, 100] WITHOUT being required.
    const s100 = fakeSkill("alpha", { meta: { triggers: ["alpha-trigger"] } });
    const s90 = fakeSkill("bravo");
    const s85 = fakeSkill("charlie");
    const s80 = fakeSkill("delta");

    // Achieve 100 via template_required would mark as required; instead use
    // explicit_user (80) + trigger (25) = 105, etc. We need exact: 100, 90, 85, 80.
    // Use template_recommended (60) + explicit_user (80) = 140. Too high.
    // Simpler: use template_required (100) but include all 4 as required would defeat the test.
    //
    // Achievable non-required combos:
    //   80 = explicit_user
    //   100 = explicit_user (80) + applies_to (10) + cluster (15) -> 105 (off)
    //
    // Instead, hand-build a stub-mode test by patching scores directly via
    // arranging known sources:
    //   s100 = template_recommended (60) + explicit_user (80) = 140  — not 100.
    //
    // Simplest precise approach: use explicit_user only, all = 80. Then verify
    // top 2 picked by stable name order.
    const out = detectSkills(
      baseInput({
        registry: [s100, s90, s85, s80],
        prompt: "alpha bravo charlie delta",
        maxSelected: 2,
      }),
    );

    // All four score exactly 80 via explicit_user.
    expect(out.picked).toHaveLength(2);
    // Tie at 80 → sorted ascending by name: alpha, bravo.
    expect(out.picked.map((e) => e.name)).toEqual(["alpha", "bravo"]);
    // Remaining two not promoted past cap.
    expect(out.picked.map((e) => e.name)).not.toContain("charlie");
    expect(out.picked.map((e) => e.name)).not.toContain("delta");
  });

  it("breaks ties within picked by ascending name (alpha before zebra)", () => {
    const zebra = fakeSkill("zebra");
    const alpha = fakeSkill("alpha");
    const out = detectSkills(
      baseInput({
        registry: [zebra, alpha],
        templateRequired: new Set(["zebra", "alpha"]),
        maxSelected: 2,
      }),
    );

    expect(out.picked.map((e) => e.name)).toEqual(["alpha", "zebra"]);
  });

  it("flags hasTightCandidatePair when the top-two candidate gap is <= llmTieBreakGap", () => {
    // Build two candidates at 70 and 65 (gap = 5).
    // 70 = template_recommended (60) + applies_to (10).
    // 65 = template_recommended (60) + cluster (15)? cluster needs 2 distinct hits → 75. Too high.
    // Use 70 = template_recommended (60) + applies_to (10).
    // For 65: template_recommended (60) + ??? — only single bonus near 5 doesn't exist.
    //
    // Re-plan with achievable combos:
    //   75 = template_recommended (60) + cluster (15)
    //   70 = template_recommended (60) + applies_to (10)
    // gap = 5 → tight when llmTieBreakGap=10.
    const a = fakeSkill("aaa", {
      meta: { description: "redesign storefront" },
    });
    const b = fakeSkill("bbb", { meta: { appliesTo: ["init_project"] } });

    const out = detectSkills(
      baseInput({
        registry: [a, b],
        prompt: "redesign storefront",
        templateRecommended: new Set(["aaa", "bbb"]),
        contextLabels: ["init_project"],
        maxSelected: 3,
        llmTieBreakGap: 10,
      }),
    );

    expect(out.candidates.map((e) => e.score)).toEqual([75, 70]);
    expect(out.hasTightCandidatePair).toBe(true);
    expect(out.tightCandidateGap).toBe(5);
  });

  it("does NOT flag tight when the gap exceeds llmTieBreakGap", () => {
    // 75 vs 60: gap = 15.
    const a = fakeSkill("aaa", {
      meta: { description: "redesign storefront" },
    });
    const b = fakeSkill("bbb");

    const out = detectSkills(
      baseInput({
        registry: [a, b],
        prompt: "redesign storefront",
        templateRecommended: new Set(["aaa", "bbb"]),
        maxSelected: 3,
        llmTieBreakGap: 10,
      }),
    );

    expect(out.candidates.map((e) => e.score)).toEqual([75, 60]);
    expect(out.hasTightCandidatePair).toBe(false);
    expect(out.tightCandidateGap).toBeNull();
  });

  it("ignores templateRequired entries that aren't in the registry (registry is source of truth)", () => {
    const real = fakeSkill("real");
    const out = detectSkills(
      baseInput({
        registry: [real],
        templateRequired: new Set(["ghost", "real"]),
      }),
    );

    const allEntries = [
      ...out.picked,
      ...out.candidates,
      ...out.metadataOnly,
      ...out.ignored,
    ];
    expect(allEntries.map((e) => e.name)).not.toContain("ghost");
    expect(out.picked.map((e) => e.name)).toEqual(["real"]);
  });
});
