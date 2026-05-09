export const THINKING_LAYER_CONFIG = {
  model: process.env.OPENAI_THINKING_MODEL ?? "gpt-5.5",
  providerMode: "non_stream_structured_output",
  exposeRawThinkingToClient: false,
  maxSchemaRetries: 1,
  maxBusinessRepairRetries: 1,
  confidence: {
    askClarificationBelow: 0.55,
    highConfidenceAtOrAbove: 0.8,
  },
  riskPolicy: {
    forceClarificationForHighRisk: true,
    forceClarificationForForbiddenActions: true,
    forceClarificationForStackChanges: true,
    forceClarificationForDestructiveChanges: true,
    safeNextSteps: ["ask_clarification", "reject_or_safe_redirect"],
  },
  timeoutMs: 30_000,
  persistValidatedThinkingResult: true,
  persistRawProviderOutput: false,
} as const;

export const THINKING_RETRY_POLICY = {
  maxSchemaRetries: 1,
  maxBusinessRepairRetries: 1,
  fallbackOnFailure: "clarification_required",
} as const;
