import type { ProjectRunStore } from "@/features/projects/legacy/project-run-store.server";
import type { AgentRun } from "@/features/projects/legacy/project-state.schema";
import type { ThinkingResult, ThinkingRunSummary } from "./thinking.schema";

export function toThinkingRunSummary(result: ThinkingResult, createdAt = new Date().toISOString()): ThinkingRunSummary {
  return {
    thinkingResultId: result.id,
    userFacingUnderstanding: result.userFacingUnderstanding,
    lifecycleIntent: result.promptClassification.lifecycleIntent,
    normalizedGoal: result.downstreamTask.normalizedGoal,
    extractedWishCount: result.extractedWishes.length,
    riskLevel: result.riskAssessment.level,
    requiresUserConfirmation: result.riskAssessment.requiresUserConfirmation,
    downstreamTaskType: result.downstreamTask.taskType,
    createdAt,
  };
}

export async function saveThinkingResultSummary(args: {
  runStore: ProjectRunStore;
  run: AgentRun;
  result: ThinkingResult;
}): Promise<AgentRun> {
  return args.runStore.saveThinking(args.run, toThinkingRunSummary(args.result));
}
