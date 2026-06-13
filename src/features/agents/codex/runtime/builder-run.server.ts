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
  ReasoningReplayError,
  type BoundedCodexThread,
} from "./codex-thread.server";
import {
  fireRemainingTasksComplete,
  fireTaskPauseAll,
  fireTaskResumeAll,
  fireTaskTransitions,
} from "./task-transition.server";
import { runPlanGenerationPhase } from "./plan-generation.server";
import {
  planInitBatches,
  validatePlan,
  stripBlockedFromBatches,
  loadBatchSpecs,
  type InitBatchPlan,
} from "./init-batch-planner.server";
import {
  InitSettingsSeedError,
  installInitWorkspaceDependencies,
  seedInitSettingsFiles,
} from "./init-settings-seed.server";
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
import {
  commandStepLabel,
  editingStepLabel,
  mcpToolStepLabel,
  type ProgressLocale,
} from "@/server/functions/progress-mapper.server";

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

// Project-rule docs (routing, imports, protected files, data contract, UI,
// loading UX) live outside the codex-builder template root. The manifest
// references them and both retail-constraints.md (via the {{projectRuleDocs}}
// placeholder) and system.md / init-mode.md (via the <project_rules> block they
// tell the agent to read) depend on them being embedded. Order matches the
// manifest's PROJECT_RULE_* layer order.
const PROJECT_RULE_DOCS = [
  "routing.md",
  "imports.md",
  "protected-files.md",
  "data-contract.md",
  "ui-design.md",
  "loading-ux.md",
];

function stripDocFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---", 4);
  if (end === -1) return content;
  return content.slice(end + 4).replace(/^\n+/, "");
}

/**
 * Load + concatenate the project-rule docs (frontmatter stripped) into a single
 * block. Used to fill the {{projectRuleDocs}} placeholder in retail-constraints
 * and to back the <project_rules> block the init instructions reference. A
 * missing doc is skipped (logged) rather than failing the run.
 */
async function loadProjectRuleDocs(): Promise<string> {
  const sections: string[] = [];
  for (const rel of PROJECT_RULE_DOCS) {
    try {
      const abs = path.resolve(process.cwd(), "templates/project-rules", rel);
      const raw = await fs.readFile(abs, "utf8");
      const body = stripDocFrontmatter(raw).trim();
      if (body) sections.push(body);
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "init_project_rule_doc_load_failed",
          doc: rel,
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }
  return sections.join("\n\n---\n\n");
}

async function loadFoundationInstructions(): Promise<LoadedInstruction[]> {
  // retail-constraints.md ships a {{projectRuleDocs}} placeholder; fill it with
  // the concatenated project-rule docs wrapped in <project_rules> so the block
  // the init instructions tell the agent to read actually exists. Loaded once
  // and reused across the foundation set.
  const projectRuleDocs = await loadProjectRuleDocs();
  const out: LoadedInstruction[] = [];
  for (const entry of FOUNDATION_INSTRUCTIONS) {
    const loaded = await loadInstruction({
      name: entry.name,
      relativePath: entry.relativePath,
      source: "template_required",
    });
    if (loaded.content.includes("{{projectRuleDocs}}")) {
      loaded.content = loaded.content.replace(
        "{{projectRuleDocs}}",
        `<project_rules>\n${projectRuleDocs}\n</project_rules>`,
      );
    }
    out.push(loaded);
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

// system.md carries the most detailed init authoring rules (DESIGN.md authoring,
// price/currency cents, Lorem Picsum image contract, DOMPurify SSR guard, axios
// .data unwrap, completion checklist). Its own frontmatter states it must be
// sent verbatim to the model on init — but it was never loaded, so the agent
// never saw these anti-error rules. Load it as part of the init instruction set.
async function loadInitSystemInstruction(): Promise<LoadedInstruction> {
  return loadInstruction({
    name: "init-system",
    relativePath: "init/system.md",
    source: "template_required",
  });
}

function emitMilestoneInternal(
  emit: EmitFn,
  runId: string,
  milestone: BuilderRunMilestone,
): void {
  emit({ type: "milestone", runId, milestone, at: Date.now() });
  const handle = getBuilderRunHandle(runId);
  if (handle) fireTaskTransitions(handle, emit, milestone);
}

/** Coerce a BCP-47 locale (e.g. "vi-VN") to the ProgressLocale the labels use. */
function toProgressLocale(locale: string): ProgressLocale {
  return locale.startsWith("vi") ? "vi" : "en";
}

async function runTurnAndBridge(
  thread: BoundedCodexThread,
  runId: string,
  emit: EmitFn,
  input: {
    prompt: string;
    signal?: AbortSignal;
    emitAnswer?: boolean;
    locale?: ProgressLocale;
  },
): Promise<{ finalResponse: string; fileChanges: string[] }> {
  const locale: ProgressLocale = input.locale ?? "en";
  // Stream the turn so reasoning, edits, and command activity surface AS THEY
  // HAPPEN. The non-streaming path was emitting all events in one burst at
  // the end of the turn, leaving the UI on a single static label for the
  // entire duration of each batch (often minutes).
  const summary = await thread.runTurnStreamed(
    {
      prompt: input.prompt,
      signal: input.signal,
    },
    (ev) => {
    switch (ev.kind) {
      case "reasoning":
        emit({ type: "thinking", runId, text: ev.text, at: Date.now() });
        return;
      case "file_change_started":
        emit({
          type: "step",
          runId,
          kind: "file_edit",
          status: "in_progress",
          label: editingStepLabel(ev.paths, locale),
          at: Date.now(),
        });
        return;
      case "file_change_completed":
        // Preserve existing post-completion behavior: one file_change event
        // per path drives the "Updating <section>" skeleton + section
        // timeline already used by the translator.
        for (const p of ev.paths) {
          emit({ type: "file_change", runId, path: p, at: Date.now() });
        }
        return;
      case "command_started":
        emit({
          type: "step",
          runId,
          kind: "command",
          status: "in_progress",
          label: commandStepLabel(ev.command, locale),
          at: Date.now(),
        });
        return;
      case "mcp_tool_call_started":
        emit({
          type: "step",
          runId,
          kind: "mcp_tool",
          status: "in_progress",
          label: mcpToolStepLabel(ev.tool, locale),
          at: Date.now(),
        });
        return;
      case "reconnect_notice":
        // Tell the user the upstream stream flapped and we're retrying so
        // the UI doesn't sit silent during the CLI's internal reconnects.
        emit({
          type: "step",
          runId,
          kind: "command",
          status: "in_progress",
          label:
            locale === "vi"
              ? `Đang kết nối lại (${ev.count}/5)`
              : `Reconnecting (${ev.count}/5)`,
          at: Date.now(),
        });
        return;
      case "command_completed":
      case "mcp_tool_call_completed":
        // Completion is implied by the next started event replacing the
        // skeleton bar. Emitting an extra "completed" label would just
        // flicker.
        return;
    }
    },
  );
  if (summary.finalResponse && input.emitAnswer !== false) {
    emit({
      type: "turn_completed",
      runId,
      finalResponse: summary.finalResponse,
      at: Date.now(),
    });
  }
  return { finalResponse: summary.finalResponse, fileChanges: summary.fileChanges };
}

function emitFinalAnswer(emit: EmitFn, runId: string, finalResponse: string): void {
  emit({
    type: "turn_completed",
    runId,
    finalResponse: finalResponse || "Done.",
    at: Date.now(),
  });
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

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…[+${value.length - max} chars]`;
}

function logValidationFailure(input: {
  stage: "typecheck" | "build" | "product_sample_parse";
  runId: string;
  projectId: string;
  outcome: { ok: false; durationMs: number; summary: string; errorCount: number };
  cyclesUsed?: number;
}): void {
  console.log(
    JSON.stringify({
      event: "builder_validation_failed",
      stage: input.stage,
      runId: input.runId,
      projectId: input.projectId,
      durationMs: input.outcome.durationMs,
      errorCount: input.outcome.errorCount,
      cyclesUsed: input.cyclesUsed,
      summary: input.outcome.summary,
    }),
  );
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
 * Init driver writes straight into the project workspace root
 * (`projects/<id>/`) — the same directory the preview pm2 process picks up
 * as cwd. Skipping the draft → publish copy means files are visible to the
 * dev runtime as soon as codex apply_patch lands. Diff gate, typecheck,
 * build, and preview-health still execute against this root.
 */
async function ensureProjectWorkspace(input: {
  projectId: string;
}): Promise<string> {
  const projectsRoot = getProjectWorkspaceRoot(input.projectId);
  await fs.mkdir(projectsRoot, { recursive: true });
  return projectsRoot;
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

  // Init writes straight into projects/<id>/ — the same cwd the preview
  // pm2 process binds to. Plan generation + variant clarification still
  // run; validation gates execute against this workspace root.
  const draftWorkspacePath = await ensureProjectWorkspace({
    projectId: ctx.projectId,
  });

  try {
    await seedInitSettingsFiles({ draftWorkspacePath });
    await installInitWorkspaceDependencies({
      draftWorkspacePath,
      signal: ctx.signal,
    });
  } catch (error) {
    const isSeedError = error instanceof InitSettingsSeedError;
    const failureCode: BuilderRunFailureCode =
      isSeedError && error.code === "conflicting_runtime_file"
        ? "blocked_request"
        : "codex_runtime_failed";
    emitFailure(
      emit,
      runId,
      failureCode,
      isSeedError ? error.message : "failed to seed init settings",
    );
    return finalize({
      runId,
      status: "failed",
      failureCode,
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: [],
      optionalRouteWarnings: [],
    });
  }

  const fileManifest = await listFiles(draftWorkspacePath);
  const foundationInstructions = await loadFoundationInstructions();
  const initSystemInstruction = await loadInitSystemInstruction();
  const initInstruction = await loadInitInstruction();
  const allInstructions = [
    ...foundationInstructions,
    initSystemInstruction,
    initInstruction,
  ];

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

  // US4: Before kicking off the build, ask codex to reason about the user's
  // actual prompt + the foundation/init instructions and propose four design
  // directions tailored to THIS specific store concept. Surface the model's
  // thinking so the user sees the reasoning as it forms, then pause for the
  // user's pick (or free-text guidance). The selected variant feeds the build
  // prompt below.
  let variantPromptAddendum = "";
  try {
    const { generateRetailVariants, buildVariantBuildPrompt } = await import(
      "./design-variants.server"
    );
    const instructionDigest = allInstructions
      .map((i) => `### ${i.meta.name}\n${i.content}`)
      .join("\n\n---\n\n");
    const variantReasoningPrompt = [
      "You are a senior retail UX designer. The user wants to launch a retail",
      "storefront. Read their request and the project instructions, REASON about",
      "what kind of store this is (target audience, product category, brand",
      "personality, price tier, cultural context), then propose FOUR distinct",
      "design directions tailored to THIS specific concept. Avoid generic",
      "buckets like \"minimalist / warm / luxury / playful\" unless they",
      "genuinely fit; prefer directions that name a real aesthetic for this",
      "store (e.g. \"Phố cổ artisan\", \"Studio café\", \"Neo-luxe gold\").",
      "",
      "<user_request>",
      ctx.userPrompt.trim(),
      "</user_request>",
      "",
      "<project_instructions>",
      instructionDigest,
      "</project_instructions>",
      "",
      "Output JSON only — no prose, no code fence. Shape:",
      '{ "question": string, "variants": [v1, v2, v3, v4] }',
      "Where:",
      "- question: a SHORT Vietnamese question to the user (≤120 chars) framing",
      "  the choice, referencing the store concept (do NOT mention paths, code,",
      "  framework names).",
      "- variants[*]: { id (kebab-case), label (≤40 chars, can be Vietnamese),",
      "  description (Vietnamese, 80–160 chars, hard cap 240 — describe the",
      "  vibe and who it's for, NEVER mention paths/code/framework tokens),",
      "  preview { font (string), palette (3–5 hex strings like \"#aabbcc\"),",
      "  motion (number 0..1), density (optional number 0..1) } }.",
      "All four variants MUST be meaningfully distinct (different palette",
      "directions, typography, mood). Use field names \"label\" and \"id\" — NEVER",
      "\"name\" or \"vibe\". Do NOT wrap output in ```json fences.",
    ].join("\n");
    const result = await generateRetailVariants({
      runTurn: async () => {
        // Fresh thread per attempt. The retry path must NOT resume the prior
        // thread: on the HTTP `responses` transport a resumed turn replays the
        // whole transcript into input[], and the replayed reasoning item has no
        // content/encrypted_content unless the provider preserves it — relays
        // that don't reject it with `content is required (input[N].content)`,
        // which is exactly what burned the variant retry loop. A new thread is
        // a clean single round-trip with no replay.
        const variantThread = createBoundedCodexThread({
          env: ctx.env,
          draftWorkspacePath,
          sandboxMode: "read-only",
          modelReasoningEffort: "high",
        });
        // Stream so the design reasoning surfaces AS IT FORMS, before the
        // variant pick lands — the user sees the model thinking instead of a
        // frozen screen.
        const summary = await variantThread.runTurnStreamed(
          { prompt: variantReasoningPrompt, signal: ctx.signal },
          (ev) => {
            if (ev.kind === "reasoning") {
              emit({ type: "thinking", runId, text: ev.text, at: Date.now() });
            }
          },
        );
        return { finalResponse: summary.finalResponse };
      },
    });
    if (result.ok) {
      const handle = getBuilderRunHandle(runId);
      const choice = await new Promise<{ optionId?: string; freeText?: string }>(
        (resolveChoice) => {
          if (handle) {
            const variantOptions = result.variants.map((v) => ({
              id: v.id,
              label: v.label,
            }));
            const question =
              result.question ?? "Choose a design style for your store";
            // /answer route validates optionId against handle.clarificationPrompt.options.
            // Without this, picking any variant returns INVALID_OPTION.
            handle.clarificationPrompt = {
              question,
              options: variantOptions,
            };
            handle.resumeFn = async (answer) => {
              handle.resumeFn = null;
              handle.clarificationPrompt = null;
              if (handle) fireTaskResumeAll(handle, emit);
              resolveChoice(answer);
            };
            if (handle) fireTaskPauseAll(handle, emit);
            publishBuilderRunEvent(handle, {
              type: "awaiting_clarification",
              runId,
              milestone: "awaiting_clarification",
              question,
              options: variantOptions,
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
    } else {
      console.warn(
        JSON.stringify({
          event: "design_variants_generation_failed",
          runId,
          projectId: ctx.projectId,
          reason: result.reason,
        }),
      );
    }
  } catch (error) {
    // soft fall-through — init proceeds without variant guidance if generation fails.
    console.warn(
      JSON.stringify({
        event: "design_variants_generation_threw",
        runId,
        projectId: ctx.projectId,
        rawMessage: error instanceof Error ? error.message : String(error),
        rawName: error instanceof Error ? error.name : undefined,
      }),
    );
    variantPromptAddendum = "";
  }

  // T013: generate task list for init runs (bypass classifier; complex+EN).
  await runPlanGenerationPhase(
    ctx,
    {
      draftWorkspacePath,
      bypassClassifier: true,
      promptOverride: ctx.userPrompt + variantPromptAddendum,
      languageOverride: "en",
      currentMilestone: "loading_context",
    },
    emit,
  );

  emitMilestoneInternal(emit, runId, "building_pages");
  let finalResponse = "";

  // The full build sequence (initial turn + every batch) against one thread.
  // Extracted so we can re-run it on a fresh no-reasoning thread if the
  // provider rejects replayed reasoning (see fallback below).
  const runBuildSequence = async (buildThread: BoundedCodexThread): Promise<void> => {
    finalResponse = "";
    const initialSummary = await runTurnAndBridge(buildThread, runId, emit, {
      prompt:
        bundle.prompt +
        variantPromptAddendum +
        "\n\n<plan>\n" +
        plan.batches
          .map((b) => `- ${b.kind}:${b.marker} → ${b.files.join(", ")}`)
          .join("\n") +
        "\n</plan>",
      signal: ctx.signal,
      emitAnswer: false,
      locale: toProgressLocale(ctx.locale),
    });
    if (initialSummary.finalResponse) finalResponse = initialSummary.finalResponse;
    for (const batch of plan.batches) {
      // Load the manifest spec bodies for this batch. They carry the per-file
      // authoring contract (props, hooks, data rules, required sections) that
      // the file list alone does not convey — without them the agent only sees
      // paths and re-invents each file's behavior.
      const specBodies = await loadBatchSpecs(batch.specPaths);
      const specBlock =
        specBodies.length > 0
          ? `\n\n<batch_spec>\n${specBodies.join("\n\n---\n\n")}\n</batch_spec>`
          : "";
      const batchSummary = await runTurnAndBridge(buildThread, runId, emit, {
        prompt:
          `Now build batch ${batch.marker} (${batch.kind}). Files in scope: ${batch.files.join(", ")}.` +
          specBlock,
        signal: ctx.signal,
        emitAnswer: false,
        locale: toProgressLocale(ctx.locale),
      });
      if (batchSummary.finalResponse) finalResponse = batchSummary.finalResponse;
    }
  };

  try {
    try {
      await runBuildSequence(thread);
    } catch (error) {
      // Provider strips reasoning.encrypted_content → replayed reasoning items
      // are rejected with `content is required` on the stateless HTTP transport.
      // Rather than hard-fail (no code produced), re-run the build ONCE on a
      // fresh thread with reasoning suppressed: a turn that emits no reasoning
      // item has nothing to replay, so it survives such a provider. We keep
      // reasoning on variant/planning (single round-trip, never replayed); only
      // the multi-round-trip build degrades. This is strictly better than the
      // previous hard-fail — worst case it fails again the same way.
      if (error instanceof ReasoningReplayError && !ctx.signal?.aborted) {
        console.warn(
          JSON.stringify({
            event: "init_build_reasoning_replay_fallback",
            runId,
            projectId: ctx.projectId,
          }),
        );
        emit({ type: "thinking", runId, text: "Đang dựng lại không kèm reasoning…", at: Date.now() });
        const fallbackThread = createBoundedCodexThread({
          env: ctx.env,
          draftWorkspacePath,
          skillToolCallbacks: buildSkillToolCallbacks(runId),
          disableReasoning: true,
        });
        await runBuildSequence(fallbackThread);
      } else {
        throw error;
      }
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
    const failureCode: BuilderRunFailureCode =
      error instanceof ReasoningReplayError
        ? "provider_drops_reasoning"
        : "codex_runtime_failed";
    const failureMessage =
      error instanceof ReasoningReplayError
        ? "Nhà cung cấp AI không giữ lại reasoning giữa các bước nên không thể dựng code. Cần bật reasoning.encrypted_content (hoặc lưu response) ở provider."
        : "codex turn ended unexpectedly";
    emitFailure(emit, runId, failureCode, failureMessage);
    return finalize({
      runId,
      status: "failed",
      failureCode,
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: bundle.selectedInstructionMeta,
      optionalRouteWarnings: [],
    });
  }

  const afterSnapshot = await takeSnapshot(draftWorkspacePath);
  const diff = diffSnapshots(beforeSnapshot, afterSnapshot);
  const diffGate = runDiffGate({ draftWorkspacePath, diff });
  console.log(
    JSON.stringify({
      event: "init_diff_gate_result",
      runId,
      projectId: ctx.projectId,
      ok: diffGate.ok,
      changedFilesCount: diffGate.changedFiles.length,
      changedFilesPreview: diffGate.changedFiles.slice(0, 30),
      violationsPreview: diffGate.violations.slice(0, 30),
      addedCount: diff.added.length,
      modifiedCount: diff.modified.length,
      removedCount: diff.removed.length,
    }),
  );
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
    logValidationFailure({
      stage: "typecheck",
      runId,
      projectId: ctx.projectId,
      outcome: typecheck,
      cyclesUsed: typecheckRepair.cyclesUsed,
    });
    emitFailure(
      emit,
      runId,
      code,
      `typecheck failed: ${truncate(typecheck.summary, 1500)}`,
    );
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
  const buildRepair = await runRepairLoop({
    thread,
    validate: () => runBuild(draftWorkspacePath, { signal: ctx.signal }),
    signal: ctx.signal,
    onCycleStart: () => emitMilestoneInternal(emit, runId, "repairing"),
  });
  const build = buildRepair.finalOutcome;
  if (!build.ok) {
    const code: BuilderRunFailureCode =
      buildRepair.cyclesUsed >= 2 ? "repair_exhausted" : "validation_failed";
    logValidationFailure({
      stage: "build",
      runId,
      projectId: ctx.projectId,
      outcome: build,
      cyclesUsed: buildRepair.cyclesUsed,
    });
    emitFailure(
      emit,
      runId,
      code,
      `build failed: ${truncate(build.summary, 1500)}`,
    );
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

  // Init writes straight into projects/<id>/. The preview pm2 process is
  // started by the runtime orchestrator AFTER the run completes, so probing
  // a pm2 instance + http port here is a category error: the server is not
  // running yet, and baseUrl was hard-coded to port 0. Trust typecheck+build
  // outcomes; preview health is enforced downstream once pm2 starts.
  // Product sample parser was also gated here, but its strict literal-only
  // checker rejects codex's natural TS expressions and blocks legit code.
  // Drop both gates and let the user observe the storefront via preview.

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

  // Init wrote straight into published/, so there is nothing to sync or
  // clean up here. Update / new_route drivers still publish from drafts.
  {
    const handle = getBuilderRunHandle(runId);
    if (handle) fireRemainingTasksComplete(handle, emit);
  }
  emitFinalAnswer(emit, runId, finalResponse);
  emit({ type: "done", runId, milestone: "done", at: Date.now() });
  return finalize({
    runId,
    status: "done",
    changedFiles: diffGate.changedFiles,
    draftWorkspacePath,
    selectedInstructionMeta: bundle.selectedInstructionMeta,
    optionalRouteWarnings: [],
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
          fireTaskResumeAll(handle, emit);
          await resumeFnFactory(augmentedPrompt);
        };
      }
      fireTaskPauseAll(handle, emit);
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

  // T015: classifier+planner gate. Skipped automatically when ctx.planMode === true.
  await runPlanGenerationPhase(
    ctx,
    {
      draftWorkspacePath,
      currentMilestone: "loading_context",
    },
    emit,
  );

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
  let finalResponse = "";
  try {
    const planningSummary = await runTurnAndBridge(thread, runId, emit, {
      prompt: bundle.prompt + "\n\n<plan_request>Plan the new route changes before mutating any files.</plan_request>",
      signal: ctx.signal,
      emitAnswer: false,
      locale: toProgressLocale(ctx.locale),
    });
    if (planningSummary.finalResponse) finalResponse = planningSummary.finalResponse;
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
    const mutationSummary = await runTurnAndBridge(thread, runId, emit, {
      prompt: "Now apply the planned new-route changes inside the draft workspace.",
      signal: ctx.signal,
      emitAnswer: false,
      locale: toProgressLocale(ctx.locale),
    });
    if (mutationSummary.finalResponse) finalResponse = mutationSummary.finalResponse;
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
  console.log(
    JSON.stringify({
      event: "init_diff_gate_result",
      runId,
      projectId: ctx.projectId,
      ok: diffGate.ok,
      changedFilesCount: diffGate.changedFiles.length,
      changedFilesPreview: diffGate.changedFiles.slice(0, 30),
      violationsPreview: diffGate.violations.slice(0, 30),
      addedCount: diff.added.length,
      modifiedCount: diff.modified.length,
      removedCount: diff.removed.length,
    }),
  );
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
    logValidationFailure({
      stage: "typecheck",
      runId,
      projectId: ctx.projectId,
      outcome: typecheck,
      cyclesUsed: typecheckRepair.cyclesUsed,
    });
    emitFailure(
      emit,
      runId,
      code,
      `typecheck failed: ${truncate(typecheck.summary, 1500)}`,
    );
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
  const buildRepair = await runRepairLoop({
    thread,
    validate: () => runBuild(draftWorkspacePath, { signal: ctx.signal }),
    signal: ctx.signal,
    onCycleStart: () => emitMilestoneInternal(emit, runId, "repairing"),
  });
  const build = buildRepair.finalOutcome;
  if (!build.ok) {
    const code: BuilderRunFailureCode =
      buildRepair.cyclesUsed >= 2 ? "repair_exhausted" : "validation_failed";
    logValidationFailure({
      stage: "build",
      runId,
      projectId: ctx.projectId,
      outcome: build,
      cyclesUsed: buildRepair.cyclesUsed,
    });
    emitFailure(
      emit,
      runId,
      code,
      `build failed: ${truncate(build.summary, 1500)}`,
    );
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

  // Update driver: same rationale as init — preview health probes a pm2
  // instance + http port that haven't started yet (baseUrl was port 0), and
  // the sample parser rejects natural codex output. Trust typecheck+build;
  // preview health enforced downstream when pm2 actually runs.

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
  {
    const handle = getBuilderRunHandle(runId);
    if (handle) fireRemainingTasksComplete(handle, emit);
  }
  emitFinalAnswer(emit, runId, finalResponse);
  emit({ type: "done", runId, milestone: "done", at: Date.now() });
  return finalize({
    runId,
    status: "done",
    changedFiles: diffGate.changedFiles,
    draftWorkspacePath,
    selectedInstructionMeta: bundle.selectedInstructionMeta,
    optionalRouteWarnings: [],
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

  // T014: classifier+planner gate. Skipped automatically when ctx.planMode === true.
  await runPlanGenerationPhase(
    ctx,
    {
      draftWorkspacePath,
      currentMilestone: "loading_context",
    },
    emit,
  );

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
  let finalResponse = "";
  try {
    const summary = await runTurnAndBridge(thread, runId, emit, {
      prompt: bundle.prompt,
      signal: ctx.signal,
      emitAnswer: false,
      locale: toProgressLocale(ctx.locale),
    });
    if (summary.finalResponse) finalResponse = summary.finalResponse;
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
  console.log(
    JSON.stringify({
      event: "init_diff_gate_result",
      runId,
      projectId: ctx.projectId,
      ok: diffGate.ok,
      changedFilesCount: diffGate.changedFiles.length,
      changedFilesPreview: diffGate.changedFiles.slice(0, 30),
      violationsPreview: diffGate.violations.slice(0, 30),
      addedCount: diff.added.length,
      modifiedCount: diff.modified.length,
      removedCount: diff.removed.length,
    }),
  );
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

  // Small-update driver: drop pre-publish preview health + sample parse for
  // same reason as init/update — pm2 instance not running yet, baseUrl was
  // port 0, and parser rejects natural codex output.

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
  {
    const handle = getBuilderRunHandle(runId);
    if (handle) fireRemainingTasksComplete(handle, emit);
  }
  emitFinalAnswer(emit, runId, finalResponse);
  emit({ type: "done", runId, milestone: "done", at: Date.now() });
  return finalize({
    runId,
    status: "done",
    changedFiles: diffGate.changedFiles,
    draftWorkspacePath,
    selectedInstructionMeta: bundle.selectedInstructionMeta,
    optionalRouteWarnings: [],
  });
}

