export type AgentConfig = {
  plannerModel: string;
  coderModel: string;
  summaryModel: string;
  maxRepairAttempts: number;
  maxContextFiles: number;
  maxContextChars: number;
  enableSandboxValidation: boolean;
  maxRunsPerMinute: number;
  maxPromptChars: number;
  agenticMaxIterations: number;
  agenticMaxConsecutiveToolErrors: number;
};

function readNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadAgentConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  return enforceAgentLimits({
    plannerModel: env.OPENAI_MODEL_PLANNER ?? env.OPENAI_MODEL ?? "gpt-5.4-mini",
    coderModel: env.OPENAI_MODEL_CODER ?? env.OPENAI_MODEL ?? "gpt-5.4",
    summaryModel: env.OPENAI_MODEL_SUMMARY ?? env.OPENAI_MODEL ?? "gpt-5.4-mini",
    maxRepairAttempts: readNumber(env.AGENT_MAX_REPAIR_ATTEMPTS, 2),
    maxContextFiles: readNumber(env.AGENT_MAX_CONTEXT_FILES, 12),
    maxContextChars: readNumber(env.AGENT_MAX_CONTEXT_CHARS, 120000),
    enableSandboxValidation: env.AGENT_ENABLE_SANDBOX_VALIDATION !== "false",
    maxRunsPerMinute: readNumber(env.AGENT_MAX_RUNS_PER_MINUTE, 12),
    maxPromptChars: readNumber(env.AGENT_MAX_PROMPT_CHARS, 12000),
    agenticMaxIterations: readNumber(env.AGENTIC_MAX_ITERATIONS, 40),
    agenticMaxConsecutiveToolErrors: readNumber(env.AGENTIC_MAX_CONSECUTIVE_ERRORS, 5),
  });
}

export function enforceAgentLimits(config: AgentConfig): AgentConfig {
  return {
    ...config,
    maxRepairAttempts: clamp(config.maxRepairAttempts, 0, 2),
    maxContextFiles: clamp(config.maxContextFiles, 1, 12),
    maxContextChars: clamp(config.maxContextChars, 1_000, 120_000),
    maxRunsPerMinute: clamp(config.maxRunsPerMinute, 1, 60),
    maxPromptChars: clamp(config.maxPromptChars, 1_000, 40_000),
    agenticMaxIterations: clamp(config.agenticMaxIterations, 1, 80),
    agenticMaxConsecutiveToolErrors: clamp(config.agenticMaxConsecutiveToolErrors, 1, 10),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
