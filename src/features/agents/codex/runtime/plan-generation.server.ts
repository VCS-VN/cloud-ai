import {
  classifyPromptComplexity,
  CLASSIFIER_FALLBACK,
  type ClassifierOutput,
} from "@/features/agents/codex/runtime/plan-classifier.server";
import { generatePlan } from "@/features/agents/codex/runtime/plan-generator.server";
import { fireTaskTransitions } from "@/features/agents/codex/runtime/task-transition.server";
import {
  getBuilderRunHandle,
  type BuilderRunHandle,
} from "@/features/agents/codex/runtime/builder-run-registry.server";
import type { BuilderRunContext, EmitFn } from "@/features/agents/codex/runtime/builder-run.server";
import type {
  BuilderRunMilestone,
  BuilderRunPlannedTask,
} from "@/features/agents/ui/builder-events";

export type PlanGenerationOptions = {
  draftWorkspacePath: string;
  /** When true, skip the classifier and treat the run as complex (init bypass). */
  bypassClassifier?: boolean;
  /** Override the prompt fed to the planner (init flow folds in variant context). */
  promptOverride?: string;
  /** Override the language passed to the planner. */
  languageOverride?: string;
  /**
   * Milestone the driver is currently at when calling. Used to tick the
   * matching bucket's tasks immediately after the task list lands so users
   * see something active right away (G1 fix).
   */
  currentMilestone: BuilderRunMilestone;
};

export type PlanGenerationResult = {
  tasks: BuilderRunPlannedTask[] | null;
};

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message))) {
    return true;
  }
  return false;
}

export async function runPlanGenerationPhase(
  ctx: BuilderRunContext,
  options: PlanGenerationOptions,
  emit: EmitFn,
): Promise<PlanGenerationResult> {
  if (ctx.planMode) {
    return { tasks: null };
  }

  const handle = getBuilderRunHandle(ctx.runId);
  if (!handle) {
    return { tasks: null };
  }

  const prompt = options.promptOverride ?? ctx.userPrompt;

  let classification: ClassifierOutput;
  if (options.bypassClassifier || ctx.kind === "init") {
    classification = {
      complexity: "complex",
      language: options.languageOverride ?? CLASSIFIER_FALLBACK.language,
    };
  } else {
    try {
      classification = await classifyPromptComplexity({
        runId: ctx.runId,
        prompt,
        signal: ctx.signal,
        env: ctx.env,
        draftWorkspacePath: options.draftWorkspacePath,
      });
    } catch (error) {
      if (isAbortError(error)) throw error;
      classification = CLASSIFIER_FALLBACK;
    }
  }

  if (classification.complexity === "simple") {
    return { tasks: null };
  }

  let plan;
  try {
    plan = await generatePlan({
      runId: ctx.runId,
      prompt,
      language: options.languageOverride ?? classification.language,
      signal: ctx.signal,
      env: ctx.env,
      draftWorkspacePath: options.draftWorkspacePath,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { tasks: null };
  }

  if (!plan.ok) {
    return { tasks: null };
  }

  applyPlanToHandle(handle, plan.tasks);
  emit({
    type: "plan.created",
    runId: ctx.runId,
    tasks: plan.tasks,
    at: Date.now(),
  });
  // G1: tick the current bucket immediately so the user sees prep-bucket tasks
  // active without waiting for the next milestone fire.
  fireTaskTransitions(handle, emit, options.currentMilestone);
  return { tasks: plan.tasks };
}

function applyPlanToHandle(
  handle: BuilderRunHandle,
  tasks: BuilderRunPlannedTask[],
): void {
  handle.taskList = tasks;
  handle.taskStatuses = Object.fromEntries(tasks.map((t) => [t.id, "pending" as const]));
}
