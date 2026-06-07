import type { LoadedSkill } from "./skill-loader.server";

export type SkillSource =
  | "template_required"
  | "template_recommended"
  | "explicit_user"
  | "detected";

export type SkillScore = {
  name: string;
  score: number;
  sources: { source: SkillSource; score: number }[];
};

export type DetectorOutcome = {
  picked: SkillScore[];
  candidates: SkillScore[];
  metadataOnly: SkillScore[];
  ignored: SkillScore[];
  hasTightCandidatePair: boolean;
  tightCandidateGap: number | null;
};

export type DetectorInput = {
  prompt: string;
  registry: LoadedSkill[];
  templateRequired: Set<string>;
  templateRecommended: Set<string>;
  contextLabels: string[];
  maxSelected: number;
  llmTieBreakGap: number;
};

const STOP_WORDS = new Set<string>([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "for",
  "in",
  "to",
  "with",
  "is",
  "are",
  "be",
  "skill",
  "frontend",
]);

const SOURCE_SCORES = {
  template_required: 100,
  explicit_user: 80,
  template_recommended: 60,
  trigger_match: 25,
  description_cluster: 15,
  applies_to_match: 10,
} as const;

const AUTO_INCLUDE_THRESHOLD = 80;
const CANDIDATE_THRESHOLD = 50;
const METADATA_ONLY_THRESHOLD = 30;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasWholeWordMatch(prompt: string, term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed) return false;
  // Lookarounds against alphanumerics so multi-word phrases match cleanly,
  // and case-insensitive via the i flag.
  const pattern = new RegExp(
    `(?<![A-Za-z0-9])${escapeRegex(trimmed)}(?![A-Za-z0-9])`,
    "i",
  );
  return pattern.test(prompt);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

function describesPromptCluster(
  description: string,
  promptTokens: Set<string>,
): boolean {
  const distinct = new Set<string>();
  for (const token of tokenize(description)) {
    if (STOP_WORDS.has(token)) continue;
    if (promptTokens.has(token)) distinct.add(token);
    if (distinct.size >= 2) return true;
  }
  return false;
}

function scoreSkill(
  skill: LoadedSkill,
  ctx: {
    prompt: string;
    promptLower: string;
    promptTokens: Set<string>;
    templateRequired: Set<string>;
    templateRecommended: Set<string>;
    contextSet: Set<string>;
  },
): SkillScore {
  const { name } = skill.meta;
  const sources: { source: SkillSource; score: number }[] = [];

  if (ctx.templateRequired.has(name)) {
    sources.push({
      source: "template_required",
      score: SOURCE_SCORES.template_required,
    });
  }

  let explicitMatched = hasWholeWordMatch(ctx.prompt, name);
  if (!explicitMatched) {
    for (const alias of skill.meta.aliases) {
      if (hasWholeWordMatch(ctx.prompt, alias)) {
        explicitMatched = true;
        break;
      }
    }
  }
  if (explicitMatched) {
    sources.push({
      source: "explicit_user",
      score: SOURCE_SCORES.explicit_user,
    });
  }

  if (ctx.templateRecommended.has(name)) {
    sources.push({
      source: "template_recommended",
      score: SOURCE_SCORES.template_recommended,
    });
  }

  for (const trigger of skill.meta.triggers) {
    const phrase = trigger.trim().toLowerCase();
    if (phrase.length === 0) continue;
    if (ctx.promptLower.includes(phrase)) {
      sources.push({
        source: "detected",
        score: SOURCE_SCORES.trigger_match,
      });
      break;
    }
  }

  if (describesPromptCluster(skill.meta.description, ctx.promptTokens)) {
    sources.push({
      source: "detected",
      score: SOURCE_SCORES.description_cluster,
    });
  }

  for (const label of skill.meta.appliesTo) {
    if (ctx.contextSet.has(label)) {
      sources.push({
        source: "detected",
        score: SOURCE_SCORES.applies_to_match,
      });
      break;
    }
  }

  const total = sources.reduce((sum, entry) => sum + entry.score, 0);
  return { name, score: total, sources };
}

function compareScored(a: SkillScore, b: SkillScore): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.name.localeCompare(b.name);
}

export function detectSkills(input: DetectorInput): DetectorOutcome {
  const promptLower = input.prompt.toLowerCase();
  const promptTokens = new Set(tokenize(input.prompt));
  const contextSet = new Set(input.contextLabels);
  const ctx = {
    prompt: input.prompt,
    promptLower,
    promptTokens,
    templateRequired: input.templateRequired,
    templateRecommended: input.templateRecommended,
    contextSet,
  };

  const scored = input.registry.map((skill) => scoreSkill(skill, ctx));
  scored.sort(compareScored);

  const requiredNames = new Set<string>();
  for (const entry of scored) {
    if (entry.sources.some((src) => src.source === "template_required")) {
      requiredNames.add(entry.name);
    }
  }

  const autoIncluded: SkillScore[] = [];
  const candidates: SkillScore[] = [];
  const metadataOnly: SkillScore[] = [];
  const ignored: SkillScore[] = [];

  for (const entry of scored) {
    if (entry.score >= AUTO_INCLUDE_THRESHOLD) {
      autoIncluded.push(entry);
    } else if (entry.score >= CANDIDATE_THRESHOLD) {
      candidates.push(entry);
    } else if (entry.score >= METADATA_ONLY_THRESHOLD) {
      metadataOnly.push(entry);
    } else {
      ignored.push(entry);
    }
  }

  const required: SkillScore[] = [];
  const nonRequired: SkillScore[] = [];
  for (const entry of autoIncluded) {
    if (requiredNames.has(entry.name)) required.push(entry);
    else nonRequired.push(entry);
  }

  const picked: SkillScore[] = [...required];
  if (required.length >= input.maxSelected) {
    if (required.length > input.maxSelected) {
      console.warn(
        `[skill-detector] required skill count (${required.length}) exceeds maxSelected (${input.maxSelected}); cap exceeded for required skills`,
      );
    }
  } else {
    const remaining = input.maxSelected - required.length;
    for (const entry of nonRequired.slice(0, remaining)) {
      picked.push(entry);
    }
  }

  let hasTightCandidatePair = false;
  let tightCandidateGap: number | null = null;
  if (candidates.length >= 2) {
    const gap = candidates[0].score - candidates[1].score;
    if (gap <= input.llmTieBreakGap) {
      hasTightCandidatePair = true;
      tightCandidateGap = gap;
    }
  }

  return {
    picked,
    candidates,
    metadataOnly,
    ignored,
    hasTightCandidatePair,
    tightCandidateGap,
  };
}
