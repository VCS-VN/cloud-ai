import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBuilderRunHandle,
  publishBuilderRunEvent,
  resetBuilderRunRegistryForTest,
} from "@/features/agents/codex/runtime/builder-run-registry.server";
import { runPlanGenerationPhase } from "@/features/agents/codex/runtime/plan-generation.server";
import {
  fireRemainingTasksComplete,
  fireTaskTransitions,
} from "@/features/agents/codex/runtime/task-transition.server";
import * as classifierMod from "@/features/agents/codex/runtime/plan-classifier.server";
import * as plannerMod from "@/features/agents/codex/runtime/plan-generator.server";
import type { BuilderRunContext } from "@/features/agents/codex/runtime/builder-run.server";
import type { BuilderRunEvent } from "@/features/agents/ui/builder-events";
import {
  translateBuilderEventToRunStreamEvent,
  type ProgressTimelineDirective,
} from "@/server/services/builder-run-translator.server";
import type { CodexEnvAvailable } from "@/server/env/codex";

const ENV: CodexEnvAvailable = {
  available: true,
  codexHome: "/tmp/codex",
  apiKey: "fake",
  model: "fake",
  baseUrl: undefined,
  skillsRoot: "/tmp/skills",
  maxSkillChars: 32000,
  llmTieBreakGap: 10,
  maxSelectedSkills: 3,
};

afterEach(() => {
  resetBuilderRunRegistryForTest();
  vi.restoreAllMocks();
});

describe("plan checklist end-to-end (driver wiring + translator)", () => {
  it("mocked complex run produces ordered plan.created + 6 transitions + persisted timeline", async () => {
    const runId = "run-test-1";
    const projectId = "proj-1";
    const handle = createBuilderRunHandle({
      runId,
      projectId,
      userId: undefined,
    });

    vi.spyOn(classifierMod, "classifyPromptComplexity").mockResolvedValue({
      complexity: "complex",
      language: "en",
    });
    vi.spyOn(plannerMod, "generatePlan").mockResolvedValue({
      ok: true,
      tasks: [
        { id: "p1", title: "Analyze the brand tone", phase: "prep" },
        { id: "b1", title: "Build the home page", phase: "build" },
        { id: "v1", title: "Validate the preview", phase: "verify" },
      ],
      rawResponse: "{}",
    });

    const captured: BuilderRunEvent[] = [];
    const emit = (event: BuilderRunEvent) => {
      captured.push(event);
      // Mirror the dispatcher's emit-then-publish path so the handle's
      // internal state stays consistent (helpers may read taskStatuses).
      publishBuilderRunEvent(handle, event);
    };

    const ctx: BuilderRunContext = {
      projectId,
      userId: undefined,
      runId,
      kind: "update",
      userPrompt: "Add a sticky header, hero, and product grid",
      locale: "en",
      env: ENV,
      projectSummary: null,
      reasoningEffort: null,
      planMode: false,
    };

    // Phase: loading_context (planner runs here in update driver wiring).
    await runPlanGenerationPhase(
      ctx,
      { draftWorkspacePath: "/tmp/draft", currentMilestone: "loading_context" },
      emit,
    );

    // The drivers fire fireTaskTransitions on every subsequent milestone.
    fireTaskTransitions(handle, emit, "creating_draft");
    fireTaskTransitions(handle, emit, "checking_preview");
    fireRemainingTasksComplete(handle, emit);

    // Order check on the SSE-side stream.
    const streamTypes = captured.map((e) => e.type);
    expect(streamTypes).toEqual([
      "plan.created",
      "plan.task.started", // p1 active during loading_context (prep)
      "plan.task.completed", // p1 done on entering creating_draft (build)
      "plan.task.started", // b1 active
      "plan.task.completed", // b1 done on entering checking_preview (verify)
      "plan.task.started", // v1 active
      "plan.task.completed", // v1 flushed on terminal
    ]);

    // Translator-side: every captured driver event should produce the matching
    // RunStreamEvent + persistable timeline directive.
    const translatorCtx = { runId, projectId, locale: "en" as const };
    const persistedTimeline: ProgressTimelineDirective[] = [];
    for (const event of captured) {
      const outcome = translateBuilderEventToRunStreamEvent(event, translatorCtx);
      if (outcome.timeline) persistedTimeline.push(outcome.timeline);
    }

    expect(persistedTimeline[0]).toEqual({
      kind: "task_plan",
      tasks: handle.taskList,
    });
    const transitions = persistedTimeline.slice(1) as Array<
      Extract<ProgressTimelineDirective, { kind: "task_transition" }>
    >;
    expect(transitions.map((t) => `${t.id}:${t.transition}`)).toEqual([
      "p1:started",
      "p1:completed",
      "b1:started",
      "b1:completed",
      "v1:started",
      "v1:completed",
    ]);

    // Final handle state — every task done.
    expect(handle.taskStatuses).toEqual({ p1: "done", b1: "done", v1: "done" });
  });

  it("plan-mode run skips plan generation entirely (no plan.created)", async () => {
    const runId = "run-test-2";
    const projectId = "proj-2";
    createBuilderRunHandle({ runId, projectId, userId: undefined });

    const classifier = vi.spyOn(classifierMod, "classifyPromptComplexity");
    const planner = vi.spyOn(plannerMod, "generatePlan");

    const emitted: BuilderRunEvent[] = [];
    await runPlanGenerationPhase(
      {
        projectId,
        userId: undefined,
        runId,
        kind: "update",
        userPrompt: "x",
        locale: "en",
        env: ENV,
        projectSummary: null,
        reasoningEffort: null,
        planMode: true,
      },
      { draftWorkspacePath: "/tmp/draft", currentMilestone: "loading_context" },
      (event) => emitted.push(event),
    );

    expect(emitted).toEqual([]);
    expect(classifier).not.toHaveBeenCalled();
    expect(planner).not.toHaveBeenCalled();
  });

  it("classifier=simple run skips planner (no checklist for trivial prompts)", async () => {
    const runId = "run-test-3";
    const projectId = "proj-3";
    createBuilderRunHandle({ runId, projectId, userId: undefined });

    vi.spyOn(classifierMod, "classifyPromptComplexity").mockResolvedValue({
      complexity: "simple",
      language: "en",
    });
    const planner = vi.spyOn(plannerMod, "generatePlan");

    const emitted: BuilderRunEvent[] = [];
    await runPlanGenerationPhase(
      {
        projectId,
        userId: undefined,
        runId,
        kind: "update",
        userPrompt: "Change the hero text",
        locale: "en",
        env: ENV,
        projectSummary: null,
        reasoningEffort: null,
        planMode: false,
      },
      { draftWorkspacePath: "/tmp/draft", currentMilestone: "loading_context" },
      (event) => emitted.push(event),
    );

    expect(emitted).toEqual([]);
    expect(planner).not.toHaveBeenCalled();
  });
});
