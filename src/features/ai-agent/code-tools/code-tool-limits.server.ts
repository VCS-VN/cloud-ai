export const CODE_TOOL_LIMITS = {
  maxToolLoopIterations: 40,
  maxMutationToolsPerMessage: 8,
  maxValidationAttempts: 3,
  maxRepairAttempts: 2,
  maxFilesChangedWithoutReview: 12,
  maxPatchBytes: 300_000,
  maxToolOutputBytes: 120_000,
} as const;

