import path from "node:path";
import { z } from "zod";

const codexSchema = z.object({
  CODEX_HOME: z.string().min(1).optional(),
  CODEX_API_KEY: z.string().min(1).optional(),
  CODEX_MODEL: z.string().min(1).optional(),
  CODEX_REPAIR_MODEL: z.string().min(1).optional(),
  CODEX_BASE_URL: z.string().url().optional(),
  SKILLS_ROOT: z.string().min(1).optional(),
  MAX_SKILL_CHARS: z.coerce.number().int().positive().optional(),
  LLM_TIE_BREAK_GAP: z.coerce.number().int().nonnegative().optional(),
  MAX_SELECTED_SKILLS: z.coerce.number().int().positive().optional(),
});

export const DEFAULT_MAX_SKILL_CHARS = 32000;
export const DEFAULT_LLM_TIE_BREAK_GAP = 10;
export const DEFAULT_MAX_SELECTED_SKILLS = 3;

export type CodexEnvAvailable = {
  available: true;
  codexHome: string;
  apiKey: string;
  model: string;
  repairModel?: string;
  baseUrl: string | undefined;
  skillsRoot: string;
  maxSkillChars: number;
  llmTieBreakGap: number;
  maxSelectedSkills: number;
};

export type CodexEnvUnavailable = {
  available: false;
  reason: string;
  missing: string[];
};

export type CodexEnv = CodexEnvAvailable | CodexEnvUnavailable;

function defaultCodexHome(): string {
  return process.env.NODE_ENV === "production"
    ? "/var/bin/cloud-ai/codex-home"
    : path.join(process.cwd(), ".cache/codex-home");
}

function defaultSkillsRoot(): string {
  return process.env.NODE_ENV === "production"
    ? "/var/bin/skills"
    : path.join(process.cwd(), "skills");
}

export function loadCodexEnv(env: NodeJS.ProcessEnv = process.env): CodexEnv {
  const parsed = codexSchema.safeParse(env);
  console.log("🚀 ~ loadCodexEnv ~ parsed:", JSON.stringify(parsed));
  if (!parsed.success) {
    return {
      available: false,
      reason: "codex_env_invalid",
      missing: parsed.error.issues.map((issue) => issue.path.join(".")),
    };
  }
  const v = parsed.data;
  const missing: string[] = [];
  if (!v.CODEX_API_KEY) missing.push("CODEX_API_KEY");
  if (!v.CODEX_MODEL) missing.push("CODEX_MODEL");
  if (missing.length > 0) {
    return { available: false, reason: "codex_env_missing", missing };
  }
  return {
    available: true,
    codexHome: v.CODEX_HOME ?? defaultCodexHome(),
    apiKey: v.CODEX_API_KEY!,
    model: v.CODEX_MODEL!,
    repairModel: v.CODEX_REPAIR_MODEL,
    baseUrl: v.CODEX_BASE_URL,
    skillsRoot: v.SKILLS_ROOT ?? defaultSkillsRoot(),
    maxSkillChars: v.MAX_SKILL_CHARS ?? DEFAULT_MAX_SKILL_CHARS,
    llmTieBreakGap: v.LLM_TIE_BREAK_GAP ?? DEFAULT_LLM_TIE_BREAK_GAP,
    maxSelectedSkills: v.MAX_SELECTED_SKILLS ?? DEFAULT_MAX_SELECTED_SKILLS,
  };
}

export function redactCodexEnv(env: CodexEnv): Record<string, unknown> {
  if (!env.available) return { ...env };
  return {
    available: true,
    codexHome: env.codexHome,
    model: env.model,
    repairModel: env.repairModel,
    baseUrl: env.baseUrl,
    skillsRoot: env.skillsRoot,
    maxSkillChars: env.maxSkillChars,
    llmTieBreakGap: env.llmTieBreakGap,
    maxSelectedSkills: env.maxSelectedSkills,
    apiKey: "[REDACTED]",
  };
}
