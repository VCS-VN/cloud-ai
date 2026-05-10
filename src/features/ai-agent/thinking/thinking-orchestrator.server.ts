import type { ProjectRunStore } from "../project/project-run-store.server";
import { redactSecrets } from "../security/secret-redactor";
import { runThinkingLayer as runThinkingLayerCore, type RunThinkingLayerInput as RunThinkingLayerCoreInput } from "./thinking-runner";
import { saveThinkingResultSummary } from "./thinking.repository.server";

export type RunThinkingLayerInput = RunThinkingLayerCoreInput & {
  runStore?: ProjectRunStore;
};

export async function runThinkingLayer(input: RunThinkingLayerInput) {
  const { runStore, ...coreInput } = input;
  const startedAt = Date.now();
  let repaired = false;
  try {
    const result = await runThinkingLayerCore({
      ...coreInput,
      provider: undefined,
      saveResult: input.saveResult ?? (runStore ? async (thinkingResult) => {
        await saveThinkingResultSummary({ runStore, run: input.run, result: thinkingResult });
      } : undefined),
    });
    repaired = result.riskAssessment.reasons.some((reason) => /repair/i.test(reason));
    console.info(JSON.stringify({
      event: "thinking_layer_completed",
      projectId: input.projectId,
      runId: input.run.id,
      model: input.agentConfig?.plannerModel,
      durationMs: Date.now() - startedAt,
      intent: result.promptClassification.lifecycleIntent,
      confidence: result.promptClassification.confidence,
      riskLevel: result.riskAssessment.level,
      recommendedNextStep: result.downstreamTask.taskType,
      schemaValidationOk: true,
      businessValidationOk: result.downstreamTask.taskType !== "needs_clarification" || result.riskAssessment.requiresUserConfirmation,
      repaired,
    }));
    return result;
  } catch (error) {
    console.error(JSON.stringify({
      event: "thinking_layer_failed",
      projectId: input.projectId,
      runId: input.run.id,
      durationMs: Date.now() - startedAt,
      error: redactSecrets(error instanceof Error ? error.message : "Unknown thinking layer error."),
    }));
    throw error;
  }
}
