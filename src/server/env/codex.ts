import path from "node:path";
import { z } from "zod";

const codexSchema = z.object({
  CODEX_HOME: z.string().min(1).optional(),
  CODEX_API_KEY: z.string().min(1).optional(),
  CODEX_MODEL: z.string().min(1).optional(),
  CODEX_BASE_URL: z.string().url().optional(),
  SKILLS_ROOT: z.string().min(1).optional(),
});

export type CodexEnvAvailable = {
  available: true;
  codexHome: string;
  apiKey: string;
  model: string;
  baseUrl: string | undefined;
  skillsRoot: string;
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
    baseUrl: v.CODEX_BASE_URL,
    skillsRoot: v.SKILLS_ROOT ?? defaultSkillsRoot(),
  };
}

export function redactCodexEnv(env: CodexEnv): Record<string, unknown> {
  if (!env.available) return { ...env };
  return {
    available: true,
    codexHome: env.codexHome,
    model: env.model,
    baseUrl: env.baseUrl,
    skillsRoot: env.skillsRoot,
    apiKey: "[REDACTED]",
  };
}
