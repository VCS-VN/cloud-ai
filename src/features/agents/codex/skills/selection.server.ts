import type { CodexEnvAvailable } from "@/server/env/codex";
import {
  detectSkills,
  type DetectorOutcome,
  type SkillScore,
} from "./detector.server";
import { runTieBreak, type TieBreakClient, type TieBreakOutcome } from "./tie-break.server";
import type { LoadedSkill } from "./skill-loader.server";

export type SelectionInput = {
  prompt: string;
  registry: LoadedSkill[];
  templateRequired: Set<string>;
  templateRecommended: Set<string>;
  contextLabels: string[];
  env: CodexEnvAvailable;
  tieBreakClient?: TieBreakClient;
};

export type PendingSkillReason =
  | "tie_break_ambiguous"
  | "tie_break_failed"
  | "policy_when_ambiguous_user_choice"
  | "policy_always_before_apply";

export type SelectionPicked = {
  name: string;
  score: number;
  source: "template_required" | "template_recommended" | "explicit_user" | "detected";
};

export type SelectionPending = {
  name: string;
  score: number;
  source: SelectionPicked["source"];
  reason: PendingSkillReason;
};

export type SelectionOutcome = {
  detector: DetectorOutcome;
  picked: SelectionPicked[];
  pending: SelectionPending[];
  tieBreakInvoked: boolean;
  tieBreakResult: TieBreakOutcome | null;
  clarificationRequired: boolean;
  requiredUnavailable: string[];
};

function dominantSource(score: SkillScore): SelectionPicked["source"] {
  for (const source of ["template_required", "explicit_user", "template_recommended"] as const) {
    if (score.sources.some((s) => s.source === source)) return source;
  }
  return "detected";
}

function toPicked(score: SkillScore): SelectionPicked {
  return {
    name: score.name,
    score: score.score,
    source: dominantSource(score),
  };
}

function toPending(score: SkillScore, reason: PendingSkillReason): SelectionPending {
  return {
    name: score.name,
    score: score.score,
    source: dominantSource(score),
    reason,
  };
}

function findSkill(registry: LoadedSkill[], name: string): LoadedSkill | undefined {
  return registry.find((s) => s.meta.name === name);
}

function policyForcesClarification(
  registry: LoadedSkill[],
  picked: SkillScore[],
): boolean {
  for (const score of picked) {
    const skill = findSkill(registry, score.name);
    if (!skill) continue;
    if (skill.meta.clarificationPolicy === "always_before_apply") return true;
  }
  return false;
}

export async function selectSkills(input: SelectionInput): Promise<SelectionOutcome> {
  const registryNames = new Set(input.registry.map((s) => s.meta.name));
  const requiredUnavailable: string[] = [];
  for (const required of input.templateRequired) {
    if (!registryNames.has(required)) requiredUnavailable.push(required);
  }
  for (const recommended of input.templateRecommended) {
    if (!registryNames.has(recommended)) {
      console.warn(`[skills] recommendedSkill not in registry: ${recommended}`);
    }
  }
  if (requiredUnavailable.length > 0) {
    return {
      detector: {
        picked: [],
        candidates: [],
        metadataOnly: [],
        ignored: [],
        hasTightCandidatePair: false,
        tightCandidateGap: null,
      },
      picked: [],
      pending: [],
      tieBreakInvoked: false,
      tieBreakResult: null,
      clarificationRequired: false,
      requiredUnavailable,
    };
  }

  const detector = detectSkills({
    prompt: input.prompt,
    registry: input.registry,
    templateRequired: input.templateRequired,
    templateRecommended: input.templateRecommended,
    contextLabels: input.contextLabels,
    maxSelected: input.env.maxSelectedSkills,
    llmTieBreakGap: input.env.llmTieBreakGap,
  });

  if (policyForcesClarification(input.registry, detector.picked)) {
    return {
      detector,
      picked: [],
      pending: detector.picked.map((s) => toPending(s, "policy_always_before_apply")),
      tieBreakInvoked: false,
      tieBreakResult: null,
      clarificationRequired: true,
      requiredUnavailable: [],
    };
  }

  if (!detector.hasTightCandidatePair) {
    return {
      detector,
      picked: detector.picked.map(toPicked),
      pending: [],
      tieBreakInvoked: false,
      tieBreakResult: null,
      clarificationRequired: false,
      requiredUnavailable: [],
    };
  }

  const tightTop = detector.candidates.slice(0, 2);
  const policyAmbiguous = tightTop.some((score) => {
    const skill = findSkill(input.registry, score.name);
    if (!skill) return false;
    return skill.meta.clarificationPolicy === "when_ambiguous";
  });

  if (!policyAmbiguous) {
    return {
      detector,
      picked: detector.picked.map(toPicked),
      pending: [],
      tieBreakInvoked: false,
      tieBreakResult: null,
      clarificationRequired: false,
      requiredUnavailable: [],
    };
  }

  const tieBreakResult = await runTieBreak({
    prompt: input.prompt,
    candidates: tightTop,
    registry: input.registry,
    env: input.env,
    client: input.tieBreakClient,
  });

  if (tieBreakResult.ok && "pick" in tieBreakResult && tieBreakResult.pick) {
    const promotedName = tieBreakResult.pick;
    const promoted = tightTop.find((s) => s.name === promotedName);
    const finalPicked = [...detector.picked.map(toPicked)];
    if (promoted && !finalPicked.some((p) => p.name === promotedName)) {
      finalPicked.push(toPicked(promoted));
    }
    return {
      detector,
      picked: finalPicked,
      pending: [],
      tieBreakInvoked: true,
      tieBreakResult,
      clarificationRequired: false,
      requiredUnavailable: [],
    };
  }

  const reason: PendingSkillReason =
    !tieBreakResult.ok ? "tie_break_failed" : "tie_break_ambiguous";
  return {
    detector,
    picked: [],
    pending: tightTop.map((s) => toPending(s, reason)),
    tieBreakInvoked: true,
    tieBreakResult,
    clarificationRequired: true,
    requiredUnavailable: [],
  };
}
