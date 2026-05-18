import type { ThinkingResult } from "../thinking/thinking.schema";

export type ReasoningEffort = "low" | "medium" | "high";

export function selectReasoningEffort(thinking: ThinkingResult, opts?: { isInit?: boolean }): ReasoningEffort {
  if (opts?.isInit) return "high";
  const risk = thinking.riskAssessment.level;
  if (risk === "high") return "high";
  if (risk === "medium") return "medium";
  const taskType = thinking.downstreamTask.taskType;
  if (taskType === "bug_fix" || taskType === "design_update") return "medium";
  return "low";
}

export function isReasoningModel(model: string | undefined): boolean {
  if (!model) return false;
  const lower = model.toLowerCase();
  return /^(o\d|gpt-5|gpt-6)/.test(lower);
}
