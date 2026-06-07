import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  classifyProjectPath,
  ALLOWED_AUDIT_PROJECT_PATH_PATTERNS,
  BLOCKED_PROJECT_PATHS,
} from "@/features/agents/codex/boundary/protected-paths";
import {
  takeSnapshot,
  diffSnapshots,
  type FilesystemSnapshot,
} from "@/features/agents/codex/boundary/filesystem-audit.server";
import { runDiffGate } from "@/features/agents/codex/boundary/diff-gate.server";
import { scanDraftForSymlinks } from "@/features/agents/codex/boundary/symlink-check.server";
import {
  runPromotionGate,
} from "@/features/agents/codex/boundary/promotion-gate.server";
import { runTypecheck } from "@/features/agents/codex/validation/typecheck.server";
import { runBuild } from "@/features/agents/codex/validation/build.server";
import { runPreviewHealth } from "@/features/agents/codex/validation/preview-health.server";
import { parseProductsSample } from "@/features/agents/codex/validation/product-sample-parser.server";
import {
  buildContextBundle,
  type LoadedInstruction,
  loadInstruction,
  type ProjectSummary,
} from "@/features/agents/codex/context";
import {
  aggregateTemplateScans,
  scanActiveTemplates,
} from "@/features/agents/codex/skills/template-scanner.server";
import { listSkills } from "@/features/agents/codex/skills/registry.server";
import {
  selectSkills,
  type SelectionOutcome,
  type SelectionPicked,
} from "@/features/agents/codex/skills/selection.server";
import type { LoadedSkill } from "@/features/agents/codex/skills/skill-loader.server";
import type { SelectedSkillForInjection } from "@/features/agents/codex/skills/injection.server";
import { buildClarificationPrompt } from "@/features/agents/codex/skills/clarification.server";
import {
  getBuilderRunHandle,
  publishBuilderRunEvent,
} from "./builder-run-registry.server";
import {
  createBoundedCodexThread,
  type BoundedCodexThread,
} from "./codex-thread.server";
import {
  planInitBatches,
  validatePlan,
  stripBlockedFromBatches,
  type InitBatchPlan,
} from "./init-batch-planner.server";
import { runRepairLoop } from "./repair-loop.server";
import { recordBoundaryViolation, type ViolationLayer } from "./violation-counter.server";
import { SMALL_UPDATE_FILE_CAP } from "./update-classifier.server";
import type {
  BuilderRunEvent,
  BuilderRunFailureCode,
  BuilderRunMilestone,
} from "@/features/agents/ui/builder-events";
import type { BuilderRunKind, BuilderRunStatus } from "@/features/agents/ui/builder-run-status";
import type { CodexEnvAvailable } from "@/server/env/codex";
import { getProjectWorkspaceRoot } from "@/server/config/paths.server";

export type BuilderRunContext = {
  projectId: string;
  userId: string | undefined;
  runId: string;
  kind: BuilderRunKind;
  userPrompt: string;
  locale: string;
  env: CodexEnvAvailable;
  projectSummary: ProjectSummary | null;
  signal?: AbortSignal;
  reasoningEffort?: "low" | "medium" | "high" | "xhigh" | null;
  planMode?: boolean;
};

export type BuilderRunOutcome = {
  runId: string;
  status: BuilderRunStatus;
  failureCode?: BuilderRunFailureCode;
  changedFiles: string[];
  draftWorkspacePath: string;
  selectedInstructionMeta: ReturnType<typeof buildContextBundle>["selectedInstructionMeta"];
  optionalRouteWarnings: string[];
};

export type EmitFn = (event: BuilderRunEvent) => void;

const FOUNDATION_INSTRUCTIONS: { name: string; relativePath: string }[] = [
  { name: "retail-constraints", relativePath: "foundation/retail-constraints.md" },
  { name: "reasoning-workflow", relativePath: "foundation/reasoning-workflow.md" },
  { name: "edit-system", relativePath: "foundation/edit-system.md" },
];

async function loadFoundationInstructions(): Promise<LoadedInstruction[]> {
  const out: LoadedInstruction[] = [];
  for (const entry of FOUNDATION_INSTRUCTIONS) {
    out.push(
      await loadInstruction({
        name: entry.name,
        relativePath: entry.relativePath,
        source: "template_required",
      }),
    );
  }
  return out;
}

async function loadInitInstruction(): Promise<LoadedInstruction> {
  return loadInstruction({
    name: "init-mode",
    relativePath: "init/init-mode.md",
    source: "template_required",
  });
}

function emitMilestoneInternal(
  emit: EmitFn,
  runId: string,
  milestone: BuilderRunMilestone,
): void {
  emit({ type: "milestone", runId, milestone, at: Date.now() });
}

async function runTurnAndBridge(
  thread: BoundedCodexThread,
  runId: string,
  emit: EmitFn,
  input: { prompt: string; signal?: AbortSignal },
): Promise<{ finalResponse: string; fileChanges: string[] }> {
  const summary = await thread.runTurn(input);
  for (const path of summary.fileChanges) {
    emit({ type: "file_change", runId, path, at: Date.now() });
  }
  if (summary.finalResponse) {
    emit({
      type: "turn_completed",
      runId,
      finalResponse: summary.finalResponse,
      at: Date.now(),
    });
  }
  return { finalResponse: summary.finalResponse, fileChanges: summary.fileChanges };
}

function emitFailure(
  emit: EmitFn,
  runId: string,
  failureCode: BuilderRunFailureCode,
  message: string,
): void {
  emit({
    type: "failed",
    runId,
    milestone: "failed",
    failureCode,
    message,
    at: Date.now(),
  });
}

function emitBoundaryViolation(
  emit: EmitFn,
  ctx: { projectId: string; userId: string | undefined; runId: string },
  layer: ViolationLayer,
  productSafeMessage: string,
): void {
  recordBoundaryViolation({
    projectId: ctx.projectId,
    userId: ctx.userId,
    layer,
  });
  emit({
    type: "failed",
    runId: ctx.runId,
    milestone: "failed",
    failureCode: "boundary_violation",
    message: productSafeMessage,
    at: Date.now(),
  });
}

async function listFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string, base: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(base, full);
      if (entry.isDirectory()) {
        await walk(full, base);
      } else if (entry.isFile()) {
        out.push(rel);
      }
    }
  }
  await walk(root, root);
  return out.sort();
}

async function ensureDraftWorkspace(input: {
  projectId: string;
  runId: string;
}): Promise<string> {
  const projectsRoot = getProjectWorkspaceRoot(input.projectId);
  const draftRoot = path.join(projectsRoot, "drafts", input.runId);
  await fs.mkdir(draftRoot, { recursive: true });
  const publishedRoot = path.join(projectsRoot, "published");
  try {
    await fs.cp(publishedRoot, draftRoot, { recursive: true });
  } catch {
    // empty published — start from blank draft
  }
  return draftRoot;
}

/**
 * Phase 6 plan-mode wrapper. When ctx.planMode is true and the kind is not init,
 * run the plan turn (read-only) before delegating to the execute driver. The
 * driver pauses on awaiting_clarification(plan_review) — a separate /answer call
 * resumes via handle.resumeFn with planAction approve|reject.
 */
export async function runWithPlanModeIfRequested(
  ctx: BuilderRunContext,
  emit: EmitFn,
  executeDriver: (ctx: BuilderRunContext, emit: EmitFn) => Promise<BuilderRunOutcome>,
): Promise<BuilderRunOutcome> {
  if (!ctx.planMode || ctx.kind === "init") {
    return executeDriver(ctx, emit);
  }

  const { runPlanTurn, buildExecuteTurnPrompt } = await import("./plan-mode.server");
  const draftWorkspacePath = await ensureDraftWorkspace({
    projectId: ctx.projectId,
    runId: ctx.runId,
  });

  emitMilestoneInternal(emit, ctx.runId, "planning");
  const planResult = await runPlanTurn(ctx, { draftWorkspacePath });
  if (!planResult.ok) {
    emitFailure(emit, ctx.runId, planResult.reason, planResult.message);
    return finalize({
      runId: ctx.runId,
      status: "failed",
      failureCode: planResult.reason,
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: [],
      optionalRouteWarnings: [],
    });
  }

  // Wait for the user's approve/reject answer via handle.resumeFn.
  const handle = getBuilderRunHandle(ctx.runId);
  if (!handle) {
    return finalize({
      runId: ctx.runId,
      status: "failed",
      failureCode: "codex_runtime_failed",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: [],
      optionalRouteWarnings: [],
    });
  }

  return await new Promise<BuilderRunOutcome>((resolve) => {
    handle.resumeFn = async (answer) => {
      handle.resumeFn = null;
      handle.clarificationPrompt = null;
      if (answer.planAction === "reject") {
        emit({ type: "cancelled", runId: ctx.runId, milestone: "cancelled", at: Date.now() });
        resolve(
          finalize({
            runId: ctx.runId,
            status: "cancelled",
            failureCode: "cancelled",
            changedFiles: [],
            draftWorkspacePath,
            selectedInstructionMeta: [],
            optionalRouteWarnings: [],
          }),
        );
        return;
      }
      // approve — feed the original task + approved plan into a NEW execute thread
      // by adjusting the user prompt for the existing execute driver.
      const augmentedPrompt = buildExecuteTurnPrompt(ctx.userPrompt, planResult.planMarkdown);
      const executeCtx: BuilderRunContext = { ...ctx, userPrompt: augmentedPrompt, planMode: false };
      const outcome = await executeDriver(executeCtx, emit);
      resolve(outcome);
    };
  });
}

async function syncDraftToPublished(
  draftPath: string,
  publishedPath: string,
): Promise<void> {
  await fs.rm(publishedPath, { recursive: true, force: true });
  await fs.mkdir(path.dirname(publishedPath), { recursive: true });
  await fs.cp(draftPath, publishedPath, { recursive: true });
}

export async function runInitBuilderRun(
  ctx: BuilderRunContext,
  emit: EmitFn,
): Promise<BuilderRunOutcome> {
  const { runId } = ctx;
  emitMilestoneInternal(emit, runId, "loading_context");

  const skillSelection = await runSkillSelection(
    ctx,
    ["init_project"],
    emit,
    async (rerunPrompt) => {
      await runInitBuilderRun({ ...ctx, userPrompt: rerunPrompt }, emit);
    },
  );
  if (skillSelection.kind === "required_unavailable") {
    return requiredUnavailableOutcome(ctx, emit, skillSelection.missing);
  }
  if (skillSelection.kind === "paused") {
    return pausedOutcome(ctx, skillSelection);
  }

  const draftWorkspacePath = await ensureDraftWorkspace({
    projectId: ctx.projectId,
    runId,
  });

  const fileManifest = await listFiles(draftWorkspacePath);
  const foundationInstructions = await loadFoundationInstructions();
  const initInstruction = await loadInitInstruction();
  const allInstructions = [...foundationInstructions, initInstruction];

  const bundle = buildContextBundle({
    projectId: ctx.projectId,
    userId: ctx.userId,
    draftWorkspacePath,
    userPrompt: ctx.userPrompt,
    locale: ctx.locale,
    projectSummary: ctx.projectSummary,
    fileManifest,
    protectedPaths: {
      blocked: BLOCKED_PROJECT_PATHS,
      allowedAudit: ALLOWED_AUDIT_PROJECT_PATH_PATTERNS.map((p) => p.source),
    },
    validationRules: { typecheck: true, build: true, previewHealth: true },
    selectedInstructions: allInstructions,
    selectedSkills: skillSelection.selected,
    skillRegistry: skillSelection.registry,
  });

  const symlinkScan = await scanDraftForSymlinks(draftWorkspacePath);
  if (!symlinkScan.ok) {
    emitFailure(
      emit,
      runId,
      "boundary_violation",
      "draft contains disallowed symlinks",
    );
    return finalize({
      runId,
      status: "failed",
      failureCode: "boundary_violation",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  emitMilestoneInternal(emit, runId, "planning");
  let plan: InitBatchPlan;
  try {
    plan = await planInitBatches();
  } catch (error) {
    emitFailure(
      emit,
      runId,
      "codex_runtime_failed",
      "failed to read init manifest",
    );
    return finalize({
      runId,
      status: "failed",
      failureCode: "codex_runtime_failed",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  let planValidation = validatePlan(plan);
  if (!planValidation.ok && planValidation.reason === "blocked_path") {
    plan = stripBlockedFromBatches(plan);
    planValidation = validatePlan(plan);
  }
  if (!planValidation.ok) {
    emitFailure(
      emit,
      runId,
      "blocked_request",
      planValidation.reason === "batch_too_large"
        ? "init plan exceeded the per-batch file cap"
        : "init plan touched a protected path",
    );
    return finalize({
      runId,
      status: "failed",
      failureCode: "blocked_request",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  emitMilestoneInternal(emit, runId, "creating_draft");
  const beforeSnapshot = await takeSnapshot(draftWorkspacePath);

  let thread: BoundedCodexThread;
  try {
    thread = createBoundedCodexThread({
      env: ctx.env,
      draftWorkspacePath,
      skillToolCallbacks: buildSkillToolCallbacks(runId),
    });
  } catch {
    emitFailure(emit, runId, "codex_runtime_failed", "failed to start codex thread");
    return finalize({
      runId,
      status: "failed",
      failureCode: "codex_runtime_failed",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  // US4: Before kicking off the build, generate four retail-vibe design variants
  // and pause for user selection. The selected variant (or freeText guidance)
  // is fed into the build prompt below.
  let variantPromptAddendum = "";
  try {
    const { generateRetailVariants, buildVariantBuildPrompt } = await import(
      "./design-variants.server"
    );
    const variantThread = createBoundedCodexThread({
      env: ctx.env,
      draftWorkspacePath,
      sandboxMode: "read-only",
      modelReasoningEffort: "high",
    });
    const result = await generateRetailVariants({
      runTurn: async () => {
        const summary = await variantThread.runTurn({
          prompt:
            "Emit exactly 4 retail-vibe design variants as STRICT JSON per the contract. " +
            "Always cover minimalist retail / warm retail / luxury retail / playful retail. " +
            "Description must be Vietnamese, ≤120 chars, NEVER mention file paths, framework tokens, or code.",
          signal: ctx.signal,
        });
        return { finalResponse: summary.finalResponse };
      },
    });
    if (result.ok) {
      const handle = getBuilderRunHandle(runId);
      const choice = await new Promise<{ optionId?: string; freeText?: string }>(
        (resolveChoice) => {
          if (handle) {
            handle.resumeFn = async (answer) => {
              handle.resumeFn = null;
              handle.clarificationPrompt = null;
              resolveChoice(answer);
            };
            publishBuilderRunEvent(handle, {
              type: "awaiting_clarification",
              runId,
              milestone: "awaiting_clarification",
              question: "Chọn phong cách thiết kế cho cửa hàng",
              options: result.variants.map((v) => ({ id: v.id, label: v.label })),
              metadata: {
                questionType: "design_variant",
                options: result.variants,
                customAnswerAllowed: true,
              },
              at: Date.now(),
            });
          } else {
            resolveChoice({});
          }
        },
      );
      const selectedVariant = result.variants.find((v) => v.id === choice.optionId);
      variantPromptAddendum =
        "\n\n" +
        buildVariantBuildPrompt({
          selectedVariant,
          freeText: choice.freeText,
        });
    }
  } catch {
    // soft fall-through — init proceeds without variant guidance if generation fails.
    variantPromptAddendum = "";
  }

  emitMilestoneInternal(emit, runId, "building_pages");
  try {
    await runTurnAndBridge(thread, runId, emit, {
      prompt:
        bundle.prompt +
        variantPromptAddendum +
        "\n\n<plan>\n" +
        plan.batches
          .map((b) => `- ${b.kind}:${b.marker} → ${b.files.join(", ")}`)
          .join("\n") +
        "\n</plan>",
      signal: ctx.signal,
    });
    for (const batch of plan.batches) {
      await runTurnAndBridge(thread, runId, emit, {
        prompt: `Now build batch ${batch.marker} (${batch.kind}). Files in scope: ${batch.files.join(", ")}.`,
        signal: ctx.signal,
      });
    }
  } catch (error) {
    if (ctx.signal?.aborted) {
      emit({ type: "cancelled", runId, milestone: "cancelled", at: Date.now() });
      return finalize({
        runId,
        status: "cancelled",
        failureCode: "cancelled",
        changedFiles: [],
        draftWorkspacePath,
        selectedInstructionMeta: bundle.selectedInstructionMeta,
        optionalRouteWarnings: [],
      });
    }
    emitFailure(
      emit,
      runId,
      "codex_runtime_failed",
      "codex turn ended unexpectedly",
    );
    return finalize({
      runId,
      status: "failed",
      failureCode: "codex_runtime_failed",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  const afterSnapshot = await takeSnapshot(draftWorkspacePath);
  const diff = diffSnapshots(beforeSnapshot, afterSnapshot);
  const diffGate = runDiffGate({ draftWorkspacePath, diff });
  if (!diffGate.ok) {
    const code: BuilderRunFailureCode = diffGate.violations.some(
      (v) => v.reason === "outside_draft_workspace",
    )
      ? "boundary_violation"
      : "blocked_request";
    if (code === "boundary_violation") {
      emitBoundaryViolation(emit, ctx, "diff_gate", "request blocked by safety check");
    } else {
      emitFailure(emit, runId, code, "request touched a protected file");
    }
    return finalize({
      runId,
      status: "failed",
      failureCode: code,
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }
  if (diffGate.changedFiles.length === 0) {
    emitFailure(emit, runId, "validation_failed", "no changes produced");
    return finalize({
      runId,
      status: "failed",
      failureCode: "validation_failed",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  emitMilestoneInternal(emit, runId, "checking_preview");
  const typecheckRepair = await runRepairLoop({
    thread,
    validate: () => runTypecheck(draftWorkspacePath, { signal: ctx.signal }),
    signal: ctx.signal,
    onCycleStart: () => emitMilestoneInternal(emit, runId, "repairing"),
  });
  const typecheck = typecheckRepair.finalOutcome;
  if (!typecheck.ok) {
    const code: BuilderRunFailureCode =
      typecheckRepair.cyclesUsed >= 2 ? "repair_exhausted" : "validation_failed";
    emitFailure(emit, runId, code, "typecheck failed");
    return finalize({
      runId,
      status: "failed",
      failureCode: code,
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }
  const build = await runBuild(draftWorkspacePath, { signal: ctx.signal });
  if (!build.ok) {
    emitFailure(emit, runId, "validation_failed", "build failed");
    return finalize({
      runId,
      status: "failed",
      failureCode: "validation_failed",
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  const sampleParse = await parseProductsSample(draftWorkspacePath);
  if (!sampleParse.ok) {
    emitFailure(
      emit,
      runId,
      "validation_failed",
      `product sample parse failed: ${sampleParse.reason}`,
    );
    return finalize({
      runId,
      status: "failed",
      failureCode: "validation_failed",
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }
  const sampleProductId = sampleParse.productId ?? undefined;

  const previewHealth = await runPreviewHealth({
    baseUrl: `http://127.0.0.1:0`,
    pm2Name: `proj-${ctx.projectId}`,
    sampleProductId,
  });
  if (!previewHealth.ok) {
    emitFailure(emit, runId, "preview_failed", previewHealth.failureReason ?? "preview health failed");
    return finalize({
      runId,
      status: "failed",
      failureCode: "preview_failed",
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  emitMilestoneInternal(emit, runId, "publishing");
  const promotion = runPromotionGate({
    expected: { projectId: ctx.projectId, userId: ctx.userId, draftWorkspacePath },
    current: { projectId: ctx.projectId, userId: ctx.userId, draftWorkspacePath },
  });
  if (!promotion.ok) {
    emitBoundaryViolation(emit, ctx, "promotion_gate", "request blocked by safety check");
    return finalize({
      runId,
      status: "failed",
      failureCode: "boundary_violation",
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  const publishedPath = path.join(getProjectWorkspaceRoot(ctx.projectId), "published");
  await syncDraftToPublished(draftWorkspacePath, publishedPath);
  await fs.rm(draftWorkspacePath, { recursive: true, force: true });
  emit({ type: "done", runId, milestone: "done", at: Date.now() });
  return finalize({
    runId,
    status: "done",
    changedFiles: diffGate.changedFiles,
    draftWorkspacePath,
    selectedInstructionMeta: bundle.selectedInstructionMeta,
    optionalRouteWarnings: previewHealth.optionalFailures,
  });
}

function finalize(outcome: BuilderRunOutcome): BuilderRunOutcome {
  return outcome;
}

function buildSkillToolCallbacks(runId: string) {
  return {
    onSuccess: (entry: { name: string; at: number }) => {
      const handle = getBuilderRunHandle(runId);
      if (handle) handle.loadedSkills.push(entry);
    },
  };
}

function pickedToInjection(picked: SelectionPicked[]): SelectedSkillForInjection[] {
  return picked.map((p) => ({ name: p.name, score: p.score, source: p.source }));
}



export type SkillSelectionResult =
  | {
      kind: "ready";
      outcome: SelectionOutcome;
      selected: SelectedSkillForInjection[];
      registry: LoadedSkill[];
    }
  | {
      kind: "paused";
      outcome: SelectionOutcome;
      registry: LoadedSkill[];
    }
  | {
      kind: "required_unavailable";
      missing: string[];
      registry: LoadedSkill[];
    };

async function runSkillSelection(
  ctx: BuilderRunContext,
  contextLabels: string[],
  emit: EmitFn,
  resumeFnFactory?: (rerunPrompt: string) => Promise<void>,
): Promise<SkillSelectionResult> {
  const registry = listSkills();
  const scans = await scanActiveTemplates();
  const aggregated = aggregateTemplateScans(scans);
  const outcome = await selectSkills({
    prompt: ctx.userPrompt,
    registry,
    templateRequired: aggregated.required,
    templateRecommended: aggregated.recommended,
    contextLabels,
    env: ctx.env,
  });

  if (outcome.requiredUnavailable.length > 0) {
    return {
      kind: "required_unavailable",
      missing: outcome.requiredUnavailable,
      registry,
    };
  }

  if (outcome.clarificationRequired) {
    const prompt = buildClarificationPrompt({
      candidates: outcome.pending,
      registry,
    });
    const handle = getBuilderRunHandle(ctx.runId);
    if (handle) {
      handle.pendingSkills = outcome.pending;
      handle.clarificationPrompt = prompt;
      handle.userPrompt = ctx.userPrompt;
      if (resumeFnFactory) {
        handle.resumeFn = async (answer) => {
          const augmentedPrompt = answer.optionId
            ? `${ctx.userPrompt}\n\n[user clarification: prefer skill ${answer.optionId}]`
            : `${ctx.userPrompt}\n\n[user clarification: ${answer.freeText ?? ""}]`;
          handle.pendingSkills = [];
          handle.clarificationPrompt = null;
          handle.resumeFn = null;
          await resumeFnFactory(augmentedPrompt);
        };
      }
    }
    publishBuilderRunEvent(handle ?? ({} as never), {
      type: "awaiting_clarification",
      runId: ctx.runId,
      milestone: "awaiting_clarification",
      question: prompt.question,
      options: prompt.options,
      metadata: {
        questionType: "skill_clarification",
        options: prompt.options,
        customAnswerAllowed: false,
      },
      at: Date.now(),
    });
    return { kind: "paused", outcome, registry };
  }

  return {
    kind: "ready",
    outcome,
    selected: pickedToInjection(outcome.picked),
    registry,
  };
}

function pausedOutcome(
  ctx: BuilderRunContext,
  result: SkillSelectionResult,
): BuilderRunOutcome {
  return {
    runId: ctx.runId,
    status: "awaiting_clarification",
    changedFiles: [],
    draftWorkspacePath: "",
    selectedInstructionMeta: [],
    optionalRouteWarnings: [],
  };
}

function requiredUnavailableOutcome(
  ctx: BuilderRunContext,
  emit: EmitFn,
  missing: string[],
): BuilderRunOutcome {
  emitFailure(
    emit,
    ctx.runId,
    "required_skill_unavailable",
    `missing required skills: ${missing.join(", ")}`,
  );
  return {
    runId: ctx.runId,
    status: "failed",
    failureCode: "required_skill_unavailable",
    changedFiles: [],
    draftWorkspacePath: "",
    selectedInstructionMeta: [],
    optionalRouteWarnings: [],
  };
}

export function newRunId(): string {
  return randomUUID();
}

export type { FilesystemSnapshot };

const NEW_ROUTE_FILE_RE = /^src\/routes\/(.+)\.tsx$/;

function deriveAddedRouteUrls(addedFiles: string[]): string[] {
  const urls: string[] = [];
  for (const file of addedFiles) {
    const match = file.match(NEW_ROUTE_FILE_RE);
    if (!match) continue;
    let routePath = match[1];
    if (routePath === "__root") continue;
    if (routePath.endsWith("/index")) routePath = routePath.slice(0, -"/index".length);
    if (routePath === "index") {
      urls.push("/");
      continue;
    }
    routePath = routePath.replace(/\$([A-Za-z0-9_]+)/g, ":$1");
    urls.push("/" + routePath);
  }
  return urls;
}

export async function runNewRouteBuilderRun(
  ctx: BuilderRunContext,
  emit: EmitFn,
): Promise<BuilderRunOutcome> {
  const { runId } = ctx;
  emitMilestoneInternal(emit, runId, "loading_context");

  const skillSelection = await runSkillSelection(
    ctx,
    ["ui_mutation"],
    emit,
    async (rerunPrompt) => {
      await runNewRouteBuilderRun({ ...ctx, userPrompt: rerunPrompt }, emit);
    },
  );
  if (skillSelection.kind === "required_unavailable") {
    return requiredUnavailableOutcome(ctx, emit, skillSelection.missing);
  }
  if (skillSelection.kind === "paused") {
    return pausedOutcome(ctx, skillSelection);
  }

  const draftWorkspacePath = await ensureDraftWorkspace({
    projectId: ctx.projectId,
    runId,
  });
  const fileManifest = await listFiles(draftWorkspacePath);
  const foundationInstructions = await loadFoundationInstructions();

  const bundle = buildContextBundle({
    projectId: ctx.projectId,
    userId: ctx.userId,
    draftWorkspacePath,
    userPrompt: ctx.userPrompt,
    locale: ctx.locale,
    projectSummary: ctx.projectSummary,
    fileManifest,
    protectedPaths: {
      blocked: BLOCKED_PROJECT_PATHS,
      allowedAudit: ALLOWED_AUDIT_PROJECT_PATH_PATTERNS.map((p) => p.source),
    },
    validationRules: { typecheck: true, build: true, previewHealth: true },
    selectedInstructions: foundationInstructions,
    selectedSkills: skillSelection.selected,
    skillRegistry: skillSelection.registry,
  });

  const symlinkScan = await scanDraftForSymlinks(draftWorkspacePath);
  if (!symlinkScan.ok) {
    emitBoundaryViolation(emit, ctx, "symlink", "request blocked by safety check");
    return finalize({
      runId,
      status: "failed",
      failureCode: "boundary_violation",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  emitMilestoneInternal(emit, runId, "planning");
  let thread: BoundedCodexThread;
  try {
    thread = createBoundedCodexThread({
      env: ctx.env,
      draftWorkspacePath,
      skillToolCallbacks: buildSkillToolCallbacks(runId),
    });
  } catch {
    emitFailure(emit, runId, "codex_runtime_failed", "failed to start codex thread");
    return finalize({
      runId,
      status: "failed",
      failureCode: "codex_runtime_failed",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }
  try {
    await runTurnAndBridge(thread, runId, emit, {
      prompt: bundle.prompt + "\n\n<plan_request>Plan the new route changes before mutating any files.</plan_request>",
      signal: ctx.signal,
    });
  } catch (error) {
    if (ctx.signal?.aborted) {
      emit({ type: "cancelled", runId, milestone: "cancelled", at: Date.now() });
      return finalize({
        runId,
        status: "cancelled",
        failureCode: "cancelled",
        changedFiles: [],
        draftWorkspacePath,
        selectedInstructionMeta: bundle.selectedInstructionMeta,
        optionalRouteWarnings: [],
      });
    }
    emitFailure(emit, runId, "codex_runtime_failed", "planning turn ended unexpectedly");
    return finalize({
      runId,
      status: "failed",
      failureCode: "codex_runtime_failed",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  emitMilestoneInternal(emit, runId, "creating_draft");
  const beforeSnapshot = await takeSnapshot(draftWorkspacePath);

  emitMilestoneInternal(emit, runId, "building_pages");
  try {
    await runTurnAndBridge(thread, runId, emit, {
      prompt: "Now apply the planned new-route changes inside the draft workspace.",
      signal: ctx.signal,
    });
  } catch (error) {
    if (ctx.signal?.aborted) {
      emit({ type: "cancelled", runId, milestone: "cancelled", at: Date.now() });
      return finalize({
        runId,
        status: "cancelled",
        failureCode: "cancelled",
        changedFiles: [],
        draftWorkspacePath,
        selectedInstructionMeta: bundle.selectedInstructionMeta,
        optionalRouteWarnings: [],
      });
    }
    emitFailure(emit, runId, "codex_runtime_failed", "mutation turn ended unexpectedly");
    return finalize({
      runId,
      status: "failed",
      failureCode: "codex_runtime_failed",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  const afterSnapshot = await takeSnapshot(draftWorkspacePath);
  const diff = diffSnapshots(beforeSnapshot, afterSnapshot);
  const diffGate = runDiffGate({ draftWorkspacePath, diff });
  if (!diffGate.ok) {
    const code: BuilderRunFailureCode = diffGate.violations.some(
      (v) => v.reason === "outside_draft_workspace",
    )
      ? "boundary_violation"
      : "blocked_request";
    if (code === "boundary_violation") {
      emitBoundaryViolation(emit, ctx, "diff_gate", "request blocked by safety check");
    } else {
      emitFailure(emit, runId, code, "request touched a protected file");
    }
    return finalize({
      runId,
      status: "failed",
      failureCode: code,
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }
  if (diffGate.changedFiles.length === 0) {
    emitFailure(emit, runId, "validation_failed", "no changes produced");
    return finalize({
      runId,
      status: "failed",
      failureCode: "validation_failed",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  emitMilestoneInternal(emit, runId, "checking_preview");
  const typecheckRepair = await runRepairLoop({
    thread,
    validate: () => runTypecheck(draftWorkspacePath, { signal: ctx.signal }),
    signal: ctx.signal,
    onCycleStart: () => emitMilestoneInternal(emit, runId, "repairing"),
  });
  const typecheck = typecheckRepair.finalOutcome;
  if (!typecheck.ok) {
    const code: BuilderRunFailureCode =
      typecheckRepair.cyclesUsed >= 2 ? "repair_exhausted" : "validation_failed";
    emitFailure(emit, runId, code, "typecheck failed");
    return finalize({
      runId,
      status: "failed",
      failureCode: code,
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }
  const build = await runBuild(draftWorkspacePath, { signal: ctx.signal });
  if (!build.ok) {
    emitFailure(emit, runId, "validation_failed", "build failed");
    return finalize({
      runId,
      status: "failed",
      failureCode: "validation_failed",
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  const sampleParse = await parseProductsSample(draftWorkspacePath);
  const sampleProductId =
    sampleParse.ok && sampleParse.productId ? sampleParse.productId : undefined;
  const extraRoutes = deriveAddedRouteUrls(diff.added);
  const previewHealth = await runPreviewHealth({
    baseUrl: `http://127.0.0.1:0`,
    pm2Name: `proj-${ctx.projectId}`,
    sampleProductId,
    extraRoutes,
  });
  if (!previewHealth.ok) {
    emitFailure(emit, runId, "preview_failed", previewHealth.failureReason ?? "preview health failed");
    return finalize({
      runId,
      status: "failed",
      failureCode: "preview_failed",
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  emitMilestoneInternal(emit, runId, "publishing");
  const promotion = runPromotionGate({
    expected: { projectId: ctx.projectId, userId: ctx.userId, draftWorkspacePath },
    current: { projectId: ctx.projectId, userId: ctx.userId, draftWorkspacePath },
  });
  if (!promotion.ok) {
    emitBoundaryViolation(emit, ctx, "promotion_gate", "request blocked by safety check");
    return finalize({
      runId,
      status: "failed",
      failureCode: "boundary_violation",
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  const publishedPath = path.join(getProjectWorkspaceRoot(ctx.projectId), "published");
  await syncDraftToPublished(draftWorkspacePath, publishedPath);
  await fs.rm(draftWorkspacePath, { recursive: true, force: true });
  emit({ type: "done", runId, milestone: "done", at: Date.now() });
  return finalize({
    runId,
    status: "done",
    changedFiles: diffGate.changedFiles,
    draftWorkspacePath,
    selectedInstructionMeta: bundle.selectedInstructionMeta,
    optionalRouteWarnings: previewHealth.optionalFailures,
  });
}

export async function runSmallUpdateBuilderRun(
  ctx: BuilderRunContext,
  emit: EmitFn,
): Promise<BuilderRunOutcome> {
  const { runId } = ctx;
  emitMilestoneInternal(emit, runId, "loading_context");

  const skillSelection = await runSkillSelection(
    ctx,
    ["ui_mutation"],
    emit,
    async (rerunPrompt) => {
      await runSmallUpdateBuilderRun({ ...ctx, userPrompt: rerunPrompt }, emit);
    },
  );
  if (skillSelection.kind === "required_unavailable") {
    return requiredUnavailableOutcome(ctx, emit, skillSelection.missing);
  }
  if (skillSelection.kind === "paused") {
    return pausedOutcome(ctx, skillSelection);
  }

  const draftWorkspacePath = await ensureDraftWorkspace({
    projectId: ctx.projectId,
    runId,
  });
  const fileManifest = await listFiles(draftWorkspacePath);
  const foundationInstructions = await loadFoundationInstructions();

  const bundle = buildContextBundle({
    projectId: ctx.projectId,
    userId: ctx.userId,
    draftWorkspacePath,
    userPrompt: ctx.userPrompt,
    locale: ctx.locale,
    projectSummary: ctx.projectSummary,
    fileManifest,
    protectedPaths: {
      blocked: BLOCKED_PROJECT_PATHS,
      allowedAudit: ALLOWED_AUDIT_PROJECT_PATH_PATTERNS.map((p) => p.source),
    },
    validationRules: { typecheck: true, build: false, previewHealth: true },
    selectedInstructions: foundationInstructions,
    selectedSkills: skillSelection.selected,
    skillRegistry: skillSelection.registry,
  });

  const symlinkScan = await scanDraftForSymlinks(draftWorkspacePath);
  if (!symlinkScan.ok) {
    emitBoundaryViolation(emit, ctx, "symlink", "request blocked by safety check");
    return finalize({
      runId,
      status: "failed",
      failureCode: "boundary_violation",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  emitMilestoneInternal(emit, runId, "creating_draft");
  const beforeSnapshot = await takeSnapshot(draftWorkspacePath);

  let thread: BoundedCodexThread;
  try {
    thread = createBoundedCodexThread({
      env: ctx.env,
      draftWorkspacePath,
      skillToolCallbacks: buildSkillToolCallbacks(runId),
    });
  } catch {
    emitFailure(emit, runId, "codex_runtime_failed", "failed to start codex thread");
    return finalize({
      runId,
      status: "failed",
      failureCode: "codex_runtime_failed",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  emitMilestoneInternal(emit, runId, "building_pages");
  try {
    await runTurnAndBridge(thread, runId, emit, { prompt: bundle.prompt, signal: ctx.signal });
  } catch (error) {
    if (ctx.signal?.aborted) {
      emit({ type: "cancelled", runId, milestone: "cancelled", at: Date.now() });
      return finalize({
        runId,
        status: "cancelled",
        failureCode: "cancelled",
        changedFiles: [],
        draftWorkspacePath,
        selectedInstructionMeta: bundle.selectedInstructionMeta,
        optionalRouteWarnings: [],
      });
    }
    emitFailure(emit, runId, "codex_runtime_failed", "codex turn ended unexpectedly");
    return finalize({
      runId,
      status: "failed",
      failureCode: "codex_runtime_failed",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  const afterSnapshot = await takeSnapshot(draftWorkspacePath);
  const diff = diffSnapshots(beforeSnapshot, afterSnapshot);
  const diffGate = runDiffGate({ draftWorkspacePath, diff });
  if (!diffGate.ok) {
    const code: BuilderRunFailureCode = diffGate.violations.some(
      (v) => v.reason === "outside_draft_workspace",
    )
      ? "boundary_violation"
      : "blocked_request";
    if (code === "boundary_violation") {
      emitBoundaryViolation(emit, ctx, "diff_gate", "request blocked by safety check");
    } else {
      emitFailure(emit, runId, code, "request touched a protected file");
    }
    return finalize({
      runId,
      status: "failed",
      failureCode: code,
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }
  if (diffGate.changedFiles.length === 0) {
    emitFailure(emit, runId, "validation_failed", "no changes produced");
    return finalize({
      runId,
      status: "failed",
      failureCode: "validation_failed",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }
  if (diffGate.changedFiles.length > SMALL_UPDATE_FILE_CAP) {
    emitFailure(
      emit,
      runId,
      "validation_failed",
      `small update changed ${diffGate.changedFiles.length} files (cap ${SMALL_UPDATE_FILE_CAP})`,
    );
    return finalize({
      runId,
      status: "failed",
      failureCode: "validation_failed",
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  emitMilestoneInternal(emit, runId, "checking_preview");
  const typecheckRepair = await runRepairLoop({
    thread,
    validate: () => runTypecheck(draftWorkspacePath, { signal: ctx.signal }),
    signal: ctx.signal,
    onCycleStart: () => emitMilestoneInternal(emit, runId, "repairing"),
  });
  const typecheck = typecheckRepair.finalOutcome;
  if (!typecheck.ok) {
    const code: BuilderRunFailureCode =
      typecheckRepair.cyclesUsed >= 2 ? "repair_exhausted" : "validation_failed";
    emitFailure(emit, runId, code, "typecheck failed");
    return finalize({
      runId,
      status: "failed",
      failureCode: code,
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  const sampleParse = await parseProductsSample(draftWorkspacePath);
  const sampleProductId =
    sampleParse.ok && sampleParse.productId ? sampleParse.productId : undefined;
  const previewHealth = await runPreviewHealth({
    baseUrl: `http://127.0.0.1:0`,
    pm2Name: `proj-${ctx.projectId}`,
    sampleProductId,
  });
  if (!previewHealth.ok) {
    emitFailure(emit, runId, "preview_failed", previewHealth.failureReason ?? "preview health failed");
    return finalize({
      runId,
      status: "failed",
      failureCode: "preview_failed",
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  emitMilestoneInternal(emit, runId, "publishing");
  const promotion = runPromotionGate({
    expected: { projectId: ctx.projectId, userId: ctx.userId, draftWorkspacePath },
    current: { projectId: ctx.projectId, userId: ctx.userId, draftWorkspacePath },
  });
  if (!promotion.ok) {
    emitBoundaryViolation(emit, ctx, "promotion_gate", "request blocked by safety check");
    return finalize({
      runId,
      status: "failed",
      failureCode: "boundary_violation",
      changedFiles: diffGate.changedFiles,
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  const publishedPath = path.join(getProjectWorkspaceRoot(ctx.projectId), "published");
  await syncDraftToPublished(draftWorkspacePath, publishedPath);
  await fs.rm(draftWorkspacePath, { recursive: true, force: true });
  emit({ type: "done", runId, milestone: "done", at: Date.now() });
  return finalize({
    runId,
    status: "done",
    changedFiles: diffGate.changedFiles,
    draftWorkspacePath,
    selectedInstructionMeta: bundle.selectedInstructionMeta,
    optionalRouteWarnings: previewHealth.optionalFailures,
  });
}

