import type { CodeToolLoopResult, ValidationResult } from "./code-agent-types";
import {
  buildCodeToolLoopCompletedEvent,
  buildCodeToolLoopStartedEvent,
  buildHumanReviewRequiredEvent,
  buildRepairStartedEvent,
  buildValidationFinishedEvent,
  summarizeValidationResult,
} from "./code-tool-events.server";
import { CODE_TOOL_LIMITS } from "./code-tool-registry.server";
import { evaluateProjectRiskPolicy } from "./services/project-risk-policy.server";

export type RunBoundedCodeToolLoopInput = {
  projectId: string;
  messageId: string;
  taskTitle: string;
  changedFiles: string[];
  maxRepairAttempts?: number;
  highRisk?: boolean;
  validate: () => Promise<ValidationResult>;
  repair?: (input: { attempt: number; validation: ValidationResult }) => Promise<{ changedFiles?: string[]; repaired: boolean }>;
  rollback?: () => Promise<void>;
  sendEvent?: (event: unknown) => void | Promise<void>;
};

export async function runBoundedCodeToolLoop(input: RunBoundedCodeToolLoopInput): Promise<CodeToolLoopResult> {
  const changedFiles = [...new Set(input.changedFiles)];
  await input.sendEvent?.(buildCodeToolLoopStartedEvent(input));

  const risk = evaluateProjectRiskPolicy({ changedFiles, highRisk: input.highRisk });
  if (risk.requiresHumanReview) {
    const reason = risk.reasons.join(" ");
    await input.sendEvent?.(buildHumanReviewRequiredEvent({ ...input, reason, changedFiles }));
    return { status: "human_review_required", summary: "Human review required before applying code changes.", changedFiles, validationStatus: "skipped", reason };
  }

  let validation = await input.validate();
  await input.sendEvent?.(buildValidationFinishedEvent({ ...input, status: validation.status, summary: summarizeValidationResult(validation) }));
  if (validation.status === "passed" || validation.status === "skipped" || !validation.canRepair) {
    await input.sendEvent?.(buildCodeToolLoopCompletedEvent({ ...input, summary: completionSummary(validation), changedFiles, validationStatus: validation.status }));
    return { status: validation.status === "failed" ? "failed" : "completed", summary: completionSummary(validation), changedFiles, validationStatus: validation.status };
  }

  const maxRepairAttempts = input.maxRepairAttempts ?? CODE_TOOL_LIMITS.maxRepairAttempts;
  for (let attempt = 1; attempt <= maxRepairAttempts; attempt += 1) {
    await input.sendEvent?.(buildRepairStartedEvent({ ...input, reason: summarizeValidationResult(validation), attempt }));
    const repair = await input.repair?.({ attempt, validation });
    if (repair?.changedFiles?.length) changedFiles.push(...repair.changedFiles.filter((file) => !changedFiles.includes(file)));
    validation = await input.validate();
    await input.sendEvent?.(buildValidationFinishedEvent({ ...input, status: validation.status, summary: summarizeValidationResult(validation) }));
    if (validation.status === "passed") {
      await input.sendEvent?.(buildCodeToolLoopCompletedEvent({ ...input, summary: "Validation passed after repair.", changedFiles, validationStatus: "passed" }));
      return { status: "completed", summary: "Validation passed after repair.", changedFiles, validationStatus: "passed" };
    }
  }

  await input.rollback?.();
  const summary = "Validation failed after repair attempts; changes rolled back for review.";
  await input.sendEvent?.(buildCodeToolLoopCompletedEvent({ ...input, summary, changedFiles, validationStatus: "failed" }));
  return { status: "failed", summary, changedFiles, validationStatus: "failed", reason: summarizeValidationResult(validation) };
}

function completionSummary(validation: ValidationResult) {
  if (validation.status === "passed") return "Code tool loop completed and validation passed.";
  if (validation.status === "skipped") return "Code tool loop completed with validation skipped.";
  return "Code tool loop completed with validation failures.";
}
