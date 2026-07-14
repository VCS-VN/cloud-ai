import { describe, expect, it, vi } from "vitest";
import type { CodexEnvAvailable } from "@/server/env/codex";
import type { SkillScore } from "@/features/agents/codex/skills/detector.server";
import type { LoadedSkill } from "@/features/agents/codex/skills/skill-loader.server";
import {
  runTieBreak,
  type TieBreakClient,
} from "@/features/agents/codex/skills/tie-break.server";

const BODY_LEAK_MARKER = "BODY-CONTENT-DO-NOT-LEAK";

const env: CodexEnvAvailable = {
  available: true,
  codexHome: "/tmp",
  apiKey: "x",
  model: "m",
  baseUrl: undefined,
  skillsRoot: "/tmp/skills",
  maxSkillChars: 32000,
  llmTieBreakGap: 10,
  maxSelectedSkills: 3,
  initBatchConcurrency: 3,
};

function makeSkill(
  name: string,
  overrides: Partial<LoadedSkill["meta"]> = {},
  body: string = BODY_LEAK_MARKER,
): LoadedSkill {
  return {
    meta: {
      name,
      description: overrides.description ?? `Description for ${name}`,
      aliases: overrides.aliases ?? [],
      triggers: overrides.triggers ?? [],
      asksClarification: overrides.asksClarification ?? false,
      clarificationPolicy: overrides.clarificationPolicy ?? "never",
      appliesTo: overrides.appliesTo ?? [],
      version: overrides.version ?? "1.0.0",
    },
    body,
    hash: "deadbeef",
    truncated: false,
  };
}

function makeScore(name: string, score = 60): SkillScore {
  return {
    name,
    score,
    sources: [{ source: "detected", score }],
  };
}

function makeClient(
  fn: (input: { prompt: string }) => Promise<unknown> | unknown,
): TieBreakClient & { resolve: ReturnType<typeof vi.fn> } {
  const resolve = vi.fn(async (input: { prompt: string }) => fn(input));
  return { resolve } as TieBreakClient & {
    resolve: ReturnType<typeof vi.fn>;
  };
}

describe("runTieBreak", () => {
  const baseRegistry = [makeSkill("skill-a"), makeSkill("skill-b")];
  const baseCandidates = [makeScore("skill-a"), makeScore("skill-b")];

  it("returns a confident pick when client returns a valid pick above threshold", async () => {
    const client = makeClient(async () => ({
      pick: "skill-a",
      confidence: 0.9,
      reason: "best fit",
    }));
    const outcome = await runTieBreak({
      prompt: "do the thing",
      candidates: baseCandidates,
      registry: baseRegistry,
      env,
      client,
    });
    expect(outcome).toEqual({
      ok: true,
      pick: "skill-a",
      confidence: 0.9,
      reason: "best fit",
    });
  });

  it("marks ambiguous when confidence is below the threshold", async () => {
    const client = makeClient(async () => ({
      pick: "skill-a",
      confidence: 0.5,
      reason: "not sure",
    }));
    const outcome = await runTieBreak({
      prompt: "do the thing",
      candidates: baseCandidates,
      registry: baseRegistry,
      env,
      client,
    });
    expect(outcome).toEqual({
      ok: true,
      ambiguous: true,
      confidence: 0.5,
      reason: "not sure",
    });
  });

  it("marks ambiguous when pick is null even with high confidence", async () => {
    const client = makeClient(async () => ({
      pick: null,
      confidence: 0.95,
      reason: "no clear winner",
    }));
    const outcome = await runTieBreak({
      prompt: "do the thing",
      candidates: baseCandidates,
      registry: baseRegistry,
      env,
      client,
    });
    expect(outcome).toEqual({
      ok: true,
      ambiguous: true,
      confidence: 0.95,
      reason: "no clear winner",
    });
  });

  it("marks ambiguous when pick is not in the candidate list", async () => {
    const client = makeClient(async () => ({
      pick: "unknown-skill",
      confidence: 0.9,
      reason: "phantom",
    }));
    const outcome = await runTieBreak({
      prompt: "do the thing",
      candidates: baseCandidates,
      registry: baseRegistry,
      env,
      client,
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect("ambiguous" in outcome && outcome.ambiguous).toBe(true);
    }
  });

  it("returns a non-ok outcome with an error message when the client throws", async () => {
    const client = makeClient(async () => {
      throw new Error("network down");
    });
    const outcome = await runTieBreak({
      prompt: "do the thing",
      candidates: baseCandidates,
      registry: baseRegistry,
      env,
      client,
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(typeof outcome.error).toBe("string");
      expect(outcome.error.length).toBeGreaterThan(0);
    }
  });

  it("handles a schema mismatch from the client", async () => {
    const client = makeClient(async () => ({ foo: "bar" }));
    const outcome = await runTieBreak({
      prompt: "do the thing",
      candidates: baseCandidates,
      registry: baseRegistry,
      env,
      client,
    });
    const acceptable =
      outcome.ok === false ||
      ("ambiguous" in outcome && outcome.ambiguous === true);
    expect(acceptable).toBe(true);
  });

  it("does not include skill body content in the prompt sent to the client", async () => {
    const client = makeClient(async () => ({
      pick: "skill-a",
      confidence: 0.9,
      reason: "ok",
    }));
    await runTieBreak({
      prompt: "do the thing",
      candidates: baseCandidates,
      registry: baseRegistry,
      env,
      client,
    });
    expect(client.resolve).toHaveBeenCalledTimes(1);
    const captured = client.resolve.mock.calls[0]![0]!.prompt as string;
    expect(captured).not.toMatch(new RegExp(BODY_LEAK_MARKER));
  });

  it("truncates per-skill descriptions when total metadata exceeds the budget", async () => {
    const longDescA = "A".repeat(2000);
    const longDescB = "B".repeat(2000);
    const registry = [
      makeSkill("skill-a", { description: longDescA }),
      makeSkill("skill-b", { description: longDescB }),
    ];
    const candidates = [makeScore("skill-a"), makeScore("skill-b")];
    const client = makeClient(async () => ({
      pick: "skill-a",
      confidence: 0.9,
      reason: "ok",
    }));
    await runTieBreak({
      prompt: "do the thing",
      candidates,
      registry,
      env,
      client,
    });
    const captured = client.resolve.mock.calls[0]![0]!.prompt as string;
    expect(captured.length).toBeLessThan(4000);
    // Neither full long description should appear verbatim in the prompt.
    expect(captured.includes(longDescA)).toBe(false);
    expect(captured.includes(longDescB)).toBe(false);
  });
});
