import type { ProjectRunStore } from "../project/project-run-store.server";
import { runThinkingLayer as runThinkingLayerCore, type RunThinkingLayerInput as RunThinkingLayerCoreInput } from "./thinking-runner";
import { saveThinkingResultSummary } from "./thinking.repository.server";

export type RunThinkingLayerInput = RunThinkingLayerCoreInput & {
  runStore?: ProjectRunStore;
};

export async function runThinkingLayer(input: RunThinkingLayerInput) {
  const { runStore, ...coreInput } = input;
  return runThinkingLayerCore({
    ...coreInput,
    saveResult: input.saveResult ?? (runStore ? async (result) => { await saveThinkingResultSummary({ runStore, run: input.run, result }); } : undefined),
  });
}
