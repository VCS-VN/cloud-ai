import { describe, expect, it, vi } from "vitest";

import { selectSkills } from "@/features/agents/codex/skills/selection.server";
import type { LoadedSkill } from "@/features/agents/codex/skills/skill-loader.server";
import type { TieBreakClient } from "@/features/agents/codex/skills/tie-break.server";
import type { CodexEnvAvailable } from "@/server/env/codex";

type SkillMetaOverrides = Partial<LoadedSkill["meta"]>;

function fakeSkill(name: string, overrides?: SkillMetaOverrides): LoadedSkill {
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
      ...overrides,
    },
    body: `Body for ${name}`,
    hash: `hash-${name}`,
    truncated: false,
  };
}

const env: CodexEnvAvailable = {
  available: true,
  codexHome: "/tmp/codex-home",
  apiKey: "test-key",
  model: "test-model",
  baseUrl: undefined,
  skillsRoot: "/tmp/skills",
  maxSkillChars: 32_000,
  maxSelectedSkills: 3,
  initBatchConcurrency: 3,
  llmTieBreakGap: 10,
};

const okPick = (name: string): TieBreakClient => ({
  resolve: vi.fn(async () => ({
    pick: name,
    confidence: 0.9,
    reason: "ok",
  })),
});

const ambiguousClient = (): TieBreakClient => ({
  resolve: vi.fn(async () => ({
    pick: null,
    confidence: 0.95,
    reason: "tie",
  })),
});

const errorClient = (): TieBreakClient => ({
  resolve: vi.fn(async () => {
    throw new Error("net");
  }),
});

describe("selectSkills", () => {
  it("clear pick: skips tie-break when one skill is auto-included via template_required", async () => {
    const foo = fakeSkill("foo");
    const tieBreakClient = okPick("foo");

    const outcome = await selectSkills({
      prompt: "",
      registry: [foo],
      templateRequired: new Set(["foo"]),
      templateRecommended: new Set(),
      contextLabels: [],
      env,
      tieBreakClient,
    });

    expect(outcome.tieBreakInvoked).toBe(false);
    expect(outcome.tieBreakResult).toBeNull();
    expect(outcome.clarificationRequired).toBe(false);
    expect(outcome.picked).toEqual([
      { name: "foo", score: 100, source: "template_required" },
    ]);
    expect(outcome.pending).toEqual([]);
    expect(tieBreakClient.resolve).not.toHaveBeenCalled();
  });

  it("tight ambiguity + tie-break confident: promotes the chosen candidate", async () => {
    const a = fakeSkill("a", { clarificationPolicy: "when_ambiguous" });
    const b = fakeSkill("b", { clarificationPolicy: "when_ambiguous" });
    const tieBreakClient = okPick("a");

    const outcome = await selectSkills({
      prompt: "anything",
      registry: [a, b],
      templateRequired: new Set(),
      templateRecommended: new Set(["a", "b"]),
      contextLabels: [],
      env,
      tieBreakClient,
    });

    expect(outcome.tieBreakInvoked).toBe(true);
    expect(outcome.clarificationRequired).toBe(false);
    expect(outcome.pending).toEqual([]);
    expect(outcome.picked).toContainEqual({
      name: "a",
      score: 60,
      source: "template_recommended",
    });
    expect(tieBreakClient.resolve).toHaveBeenCalledTimes(1);
  });

  it("tight ambiguity + tie-break ambiguous: marks candidates as pending with tie_break_ambiguous", async () => {
    const a = fakeSkill("a", { clarificationPolicy: "when_ambiguous" });
    const b = fakeSkill("b", { clarificationPolicy: "when_ambiguous" });
    const tieBreakClient = ambiguousClient();

    const outcome = await selectSkills({
      prompt: "anything",
      registry: [a, b],
      templateRequired: new Set(),
      templateRecommended: new Set(["a", "b"]),
      contextLabels: [],
      env,
      tieBreakClient,
    });

    expect(outcome.tieBreakInvoked).toBe(true);
    expect(outcome.clarificationRequired).toBe(true);
    expect(outcome.picked).toEqual([]);
    expect(outcome.pending).toHaveLength(2);
    const pendingNames = outcome.pending.map((p) => p.name).sort();
    expect(pendingNames).toEqual(["a", "b"]);
    for (const entry of outcome.pending) {
      expect(entry.reason).toBe("tie_break_ambiguous");
      expect(entry.source).toBe("template_recommended");
      expect(entry.score).toBe(60);
    }
  });

  it("tight ambiguity + tie-break network error: marks candidates as pending with tie_break_failed", async () => {
    const a = fakeSkill("a", { clarificationPolicy: "when_ambiguous" });
    const b = fakeSkill("b", { clarificationPolicy: "when_ambiguous" });
    const tieBreakClient = errorClient();

    const outcome = await selectSkills({
      prompt: "anything",
      registry: [a, b],
      templateRequired: new Set(),
      templateRecommended: new Set(["a", "b"]),
      contextLabels: [],
      env,
      tieBreakClient,
    });

    expect(outcome.tieBreakInvoked).toBe(true);
    expect(outcome.clarificationRequired).toBe(true);
    expect(outcome.picked).toEqual([]);
    expect(outcome.pending).toHaveLength(2);
    for (const entry of outcome.pending) {
      expect(entry.reason).toBe("tie_break_failed");
    }
    expect(outcome.tieBreakResult).toEqual({ ok: false, error: "net" });
  });

  it("clarificationPolicy=always_before_apply: forces clarification even without tie-break", async () => {
    const foo = fakeSkill("foo", { clarificationPolicy: "always_before_apply" });
    const tieBreakClient = okPick("foo");

    const outcome = await selectSkills({
      prompt: "",
      registry: [foo],
      templateRequired: new Set(["foo"]),
      templateRecommended: new Set(),
      contextLabels: [],
      env,
      tieBreakClient,
    });

    expect(outcome.tieBreakInvoked).toBe(false);
    expect(outcome.tieBreakResult).toBeNull();
    expect(outcome.clarificationRequired).toBe(true);
    expect(outcome.picked).toEqual([]);
    expect(outcome.pending).toEqual([
      {
        name: "foo",
        score: 100,
        source: "template_required",
        reason: "policy_always_before_apply",
      },
    ]);
    expect(tieBreakClient.resolve).not.toHaveBeenCalled();
  });

  it("clarificationPolicy=never on a tight pair: skips tie-break and keeps detector's picked", async () => {
    const a = fakeSkill("a", { clarificationPolicy: "never" });
    const b = fakeSkill("b", { clarificationPolicy: "never" });
    const tieBreakClient = okPick("a");

    const outcome = await selectSkills({
      prompt: "anything",
      registry: [a, b],
      templateRequired: new Set(),
      templateRecommended: new Set(["a", "b"]),
      contextLabels: [],
      env,
      tieBreakClient,
    });

    expect(outcome.tieBreakInvoked).toBe(false);
    expect(outcome.tieBreakResult).toBeNull();
    expect(outcome.clarificationRequired).toBe(false);
    expect(outcome.pending).toEqual([]);
    // Detector buckets these as candidates (not auto-included), so detector.picked is empty.
    expect(outcome.picked).toEqual([]);
    expect(outcome.detector.hasTightCandidatePair).toBe(true);
    expect(outcome.detector.candidates.map((c) => c.name)).toEqual(["a", "b"]);
    expect(tieBreakClient.resolve).not.toHaveBeenCalled();
  });

  it("no tight pair: skips tie-break when scores are far apart", async () => {
    const high = fakeSkill("high");
    const low = fakeSkill("low");
    const tieBreakClient = okPick("high");

    const outcome = await selectSkills({
      prompt: "",
      registry: [high, low],
      templateRequired: new Set(["high"]),
      templateRecommended: new Set(),
      contextLabels: [],
      env,
      tieBreakClient,
    });

    expect(outcome.tieBreakInvoked).toBe(false);
    expect(outcome.tieBreakResult).toBeNull();
    expect(outcome.clarificationRequired).toBe(false);
    expect(outcome.picked).toEqual([
      { name: "high", score: 100, source: "template_required" },
    ]);
    expect(outcome.pending).toEqual([]);
    expect(outcome.detector.hasTightCandidatePair).toBe(false);
    expect(tieBreakClient.resolve).not.toHaveBeenCalled();
  });
});
