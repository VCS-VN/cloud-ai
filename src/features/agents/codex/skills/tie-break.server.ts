import { Codex } from "@openai/codex-sdk";
import type { CodexEnvAvailable } from "@/server/env/codex";
import type { SkillScore } from "./detector.server";
import type { LoadedSkill } from "./skill-loader.server";

export const TIE_BREAK_CONFIDENCE_THRESHOLD = 0.6;

const METADATA_PAYLOAD_CHAR_CEILING = 3000;
const TRUNCATED_DESCRIPTION_CHARS = 200;

export type TieBreakInput = {
  prompt: string;
  candidates: SkillScore[];
  registry: LoadedSkill[];
  env: CodexEnvAvailable;
  client?: TieBreakClient;
};

export type TieBreakOutcome =
  | { ok: true; pick: string; confidence: number; reason: string }
  | { ok: true; ambiguous: true; confidence: number; reason: string }
  | { ok: false; error: string };

export type TieBreakClient = {
  resolve(input: { prompt: string }): Promise<unknown>;
};

type TieBreakCandidatePayload = {
  name: string;
  description: string;
  aliases: string[];
  triggers: string[];
  score: number;
};

type ParsedTieBreakResponse = {
  pick: string | null;
  confidence: number;
  reason: string;
};

const TIE_BREAK_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pick", "confidence", "reason"],
  properties: {
    pick: {
      type: ["string", "null"],
      description:
        "Name of the chosen skill from the candidate list, or null if no confident pick.",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    reason: {
      type: "string",
      maxLength: 400,
    },
  },
} as const;

function buildCandidatePayload(
  candidates: SkillScore[],
  registry: LoadedSkill[],
): TieBreakCandidatePayload[] {
  const byName = new Map<string, LoadedSkill>();
  for (const entry of registry) {
    byName.set(entry.meta.name, entry);
  }
  const payload: TieBreakCandidatePayload[] = [];
  for (const candidate of candidates) {
    const skill = byName.get(candidate.name);
    if (!skill) continue;
    payload.push({
      name: skill.meta.name,
      description: skill.meta.description,
      aliases: [...skill.meta.aliases],
      triggers: [...skill.meta.triggers],
      score: candidate.score,
    });
  }
  return payload;
}

function truncateDescriptions(
  payload: TieBreakCandidatePayload[],
): TieBreakCandidatePayload[] {
  return payload.map((entry) => ({
    ...entry,
    description:
      entry.description.length > TRUNCATED_DESCRIPTION_CHARS
        ? entry.description.slice(0, TRUNCATED_DESCRIPTION_CHARS)
        : entry.description,
  }));
}

function fitWithinBudget(
  payload: TieBreakCandidatePayload[],
): TieBreakCandidatePayload[] {
  const serialized = JSON.stringify(payload);
  if (serialized.length <= METADATA_PAYLOAD_CHAR_CEILING) return payload;
  return truncateDescriptions(payload);
}

export function buildTieBreakPrompt(input: {
  prompt: string;
  candidates: SkillScore[];
  registry: LoadedSkill[];
}): string {
  const payload = fitWithinBudget(
    buildCandidatePayload(input.candidates, input.registry),
  );
  const candidatesJson = JSON.stringify(payload, null, 2);
  return [
    "You are picking the single best skill to apply for a builder run.",
    "Respond ONLY in JSON matching the provided output schema.",
    "Pick the skill whose metadata best fits the user prompt.",
    "If neither skill is clearly better, return pick=null with confidence below 0.6.",
    "Never invent a skill name; pick MUST be one of the candidate `name` values or null.",
    "",
    "Candidates (metadata only, no skill body provided):",
    candidatesJson,
    "",
    "User prompt:",
    input.prompt,
  ].join("\n");
}

function parseTieBreakResponse(raw: unknown): ParsedTieBreakResponse {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `tie_break_parse_error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("tie_break_parse_error: response is not an object");
  }
  const obj = value as Record<string, unknown>;
  const pickRaw = obj.pick;
  const confidenceRaw = obj.confidence;
  const reasonRaw = obj.reason;
  if (
    !(pickRaw === null || typeof pickRaw === "string") ||
    typeof confidenceRaw !== "number" ||
    typeof reasonRaw !== "string"
  ) {
    throw new Error("tie_break_parse_error: schema mismatch");
  }
  return {
    pick: pickRaw === null ? null : pickRaw,
    confidence: confidenceRaw,
    reason: reasonRaw,
  };
}

export function createDefaultTieBreakClient(
  env: CodexEnvAvailable,
): TieBreakClient {
  return {
    async resolve(input: { prompt: string }): Promise<unknown> {
      try {
        const sdkEnv: Record<string, string> = {
          CODEX_HOME: env.codexHome,
          CODEX_API_KEY: env.apiKey,
        };
        const codex = new Codex({
          apiKey: env.apiKey,
          baseUrl: env.baseUrl,
          env: sdkEnv,
        });
        const thread = codex.startThread({
          model: env.model,
          sandboxMode: "read-only",
          skipGitRepoCheck: true,
        });
        const turn = await thread.run(input.prompt, {
          outputSchema: TIE_BREAK_OUTPUT_SCHEMA,
        });
        return turn.finalResponse;
      } catch (err) {
        throw new Error(
          `tie_break_provider_error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  };
}

export async function runTieBreak(
  input: TieBreakInput,
): Promise<TieBreakOutcome> {
  const candidateNames = new Set<string>();
  for (const candidate of input.candidates) candidateNames.add(candidate.name);

  const prompt = buildTieBreakPrompt({
    prompt: input.prompt,
    candidates: input.candidates,
    registry: input.registry,
  });

  const client = input.client ?? createDefaultTieBreakClient(input.env);

  let raw: unknown;
  try {
    raw = await client.resolve({ prompt });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let parsed: ParsedTieBreakResponse;
  try {
    parsed = parseTieBreakResponse(raw);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const { pick, confidence, reason } = parsed;
  const ambiguous =
    pick === null ||
    confidence < TIE_BREAK_CONFIDENCE_THRESHOLD ||
    !candidateNames.has(pick);

  if (ambiguous) {
    return { ok: true, ambiguous: true, confidence, reason };
  }
  return { ok: true, pick: pick as string, confidence, reason };
}
