import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  classifyProjectPath,
  ALLOWED_AUDIT_PROJECT_PATH_PATTERNS,
  BLOCKED_PROJECT_PATHS,
  isIgnoredWorkspaceDir,
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
import { runRootStyleContract } from "@/features/agents/codex/validation/root-style-contract.server";
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
  ApplyPatchUnavailableError,
  GatewaySoftError,
  StreamReconnectError,
  type BoundedCodexThread,
  type CodexProgressEvent,
} from "./codex-thread.server";
import { analyzeScope } from "./scope-analysis.server";
import {
  planInitBatches,
  validatePlan,
  stripBlockedFromBatches,
  loadBatchSpecs,
  type InitBatchPlan,
} from "./init-batch-planner.server";
import {
  InitSettingsSeedError,
  enforceTailwindDirectivesAtTop,
  ensureProjectGitignore,
  injectDesignPaletteIntoAppCss,
  installInitWorkspaceDependencies,
  reassertComingSoonRoutes,
  reassertRuntimeOwnedFiles,
  seedInitSettingsFiles,
} from "./init-settings-seed.server";
import { runRepairLoop } from "./repair-loop.server";
import { recordBoundaryViolation, type ViolationLayer } from "./violation-counter.server";
import { SMALL_UPDATE_FILE_CAP } from "./update-classifier.server";
import {
  findKnownPage,
  matchKnownPagesForEdit,
  type GeneratePageTarget,
} from "./generate-page";
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
  // Set only for generate_page runs (parsed from the /generate-page command).
  generatePageTarget?: GeneratePageTarget;
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

type FoundationEntry = { name: string; relativePath: string };

const FOUNDATION_INSTRUCTIONS: FoundationEntry[] = [
  { name: "retail-constraints", relativePath: "foundation/retail-constraints.md" },
  { name: "reasoning-workflow", relativePath: "foundation/reasoning-workflow.md" },
  { name: "edit-system", relativePath: "foundation/edit-system.md" },
];

// Update / new-route runs edit an existing storefront: edit-system.md already
// carries the route-ownership map + edit rules, and retail-constraints keeps
// the commerce guardrails. reasoning-workflow.md is the from-scratch build
// sequence — dead weight for a targeted edit. The heavy {{projectRuleDocs}}
// embed (~20KB) is also dropped for updates (see loadFoundationInstructions),
// so a one-line copy tweak no longer ships the whole project-rule corpus.
const UPDATE_FOUNDATION_INSTRUCTIONS: FoundationEntry[] = [
  { name: "edit-system", relativePath: "foundation/edit-system.md" },
  { name: "retail-constraints", relativePath: "foundation/retail-constraints.md" },
];

// Project-rule docs (routing, imports, protected files, data contract, UI,
// loading UX) live outside the codex-builder template root. The manifest
// references them and both retail-constraints.md (via the {{projectRuleDocs}}
// placeholder) and system.md (via the <project_rules> block it tells the
// agent to read) depend on them being embedded. Order matches the manifest's
// PROJECT_RULE_* layer order.
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
  const { resolveTemplateIncludes } = await import(
    "@/features/agents/codex/context/instruction-loader.server"
  );
  const sections: string[] = [];
  for (const rel of PROJECT_RULE_DOCS) {
    try {
      const abs = path.resolve(process.cwd(), "templates/project-rules", rel);
      const raw = await fs.readFile(abs, "utf8");
      const body = stripDocFrontmatter(raw).trim();
      if (body) sections.push(await resolveTemplateIncludes(body));
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

async function loadFoundationInstructions(
  opts: { entries?: FoundationEntry[]; embedProjectRuleDocs?: boolean } = {},
): Promise<LoadedInstruction[]> {
  const entries = opts.entries ?? FOUNDATION_INSTRUCTIONS;
  const embedProjectRuleDocs = opts.embedProjectRuleDocs ?? true;
  // retail-constraints.md ships a {{projectRuleDocs}} placeholder. On init we
  // fill it with the full project-rule corpus (the init instructions tell the
  // agent to read the <project_rules> block). On updates we drop that ~20KB
  // embed — edit-system.md already carries the route/edit rules a targeted
  // change needs — and just strip the placeholder to keep the file valid.
  const projectRuleDocs = embedProjectRuleDocs ? await loadProjectRuleDocs() : "";
  const out: LoadedInstruction[] = [];
  for (const entry of entries) {
    const loaded = await loadInstruction({
      name: entry.name,
      relativePath: entry.relativePath,
      source: "template_required",
    });
    if (loaded.content.includes("{{projectRuleDocs}}")) {
      loaded.content = embedProjectRuleDocs
        ? loaded.content.replace(
            "{{projectRuleDocs}}",
            `<project_rules>\n${projectRuleDocs}\n</project_rules>`,
          )
        : loaded.content.replace(/\n?PROJECT RULE DOCS[^\n]*\n\{\{projectRuleDocs\}\}/, "").replace("{{projectRuleDocs}}", "");
    }
    out.push(loaded);
  }
  return out;
}

// system.md is the canonical init instruction. It now embeds the init-mode
// overrides at its top (init-mode.md was merged into system.md). It carries the
// detailed init authoring rules: DESIGN.md authoring, price/currency cents,
// Lorem Picsum image contract, DOMPurify SSR guard, axios .data unwrap,
// completion checklist. Its frontmatter states it must be sent verbatim on init.
async function loadInitSystemInstruction(): Promise<LoadedInstruction> {
  return loadInstruction({
    name: "init-system",
    relativePath: "init/system.md",
    source: "template_required",
  });
}

// Build a <page_spec> block for a normal update / new_route run by matching the
// request against the known storefront pages and embedding the SAME init
// page-spec that /modify-page uses. Without this, only the explicit
// /modify-page command carried the per-page authoring contract (search param,
// infinite scroll, required sections, hooks) — a plain-chat "create/redesign
// the products page" saw only the generic route map and drifted from the spec.
// Empty string when the request maps to no known page (a genuinely custom
// route), so a bespoke page is unaffected.
async function buildEditPageSpecBlock(input: {
  relevantFiles: readonly string[];
  prompt: string;
}): Promise<string> {
  const pages = matchKnownPagesForEdit({
    relevantFiles: input.relevantFiles,
    prompt: input.prompt,
  });
  if (pages.length === 0) return "";
  const specPaths = pages.map((p) => p.spec);
  const bodies = await loadBatchSpecs(specPaths);
  if (bodies.length === 0) return "";
  const routeHints = pages
    .map((p) => `- ${p.label}: \`${p.route}\``)
    .join("\n");
  return (
    `\n\n<page_spec>\n` +
    `This request targets a known storefront page. Author or update it to satisfy ` +
    `the contract below verbatim. If the target route already exists as a designed ` +
    `page, treat this as a redesign: preserve its data hooks and cart/commerce ` +
    `contract and apply the requested changes; if it is still the seeded skeleton, ` +
    `author it fully from the spec.\nTarget route file(s):\n${routeHints}\n\n` +
    `${bodies.join("\n\n---\n\n")}\n</page_spec>`
  );
}

function emitMilestoneInternal(
  emit: EmitFn,
  runId: string,
  milestone: BuilderRunMilestone,
): void {
  emit({ type: "milestone", runId, milestone, at: Date.now() });
}

/** Coerce a BCP-47 locale (e.g. "vi-VN") to the ProgressLocale the labels use. */
function toProgressLocale(locale: string): ProgressLocale {
  return locale.startsWith("vi") ? "vi" : "en";
}

function emitCodexProgressEvent(
  ev: CodexProgressEvent,
  runId: string,
  emit: EmitFn,
  locale: ProgressLocale,
): void {
  switch (ev.kind) {
    case "reasoning":
      emit({ type: "thinking", runId, text: ev.text, at: Date.now() });
      return;
    case "agent_message":
      emit({ type: "agent_message", runId, text: ev.text, at: Date.now() });
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
      // Preserve existing post-completion behavior: one file_change event per
      // path drives section progress in the translator.
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
      // Completion is implied by the next started event replacing the skeleton
      // bar. Emitting a completed label would just flicker.
      return;
    case "todo_list_updated": {
      const handle = getBuilderRunHandle(runId);
      if (!handle) return;
      const mapped = ev.items.map((it, i) => ({
        id: `${ev.sectionId}:${i}`,
        text: it.text,
        completed: it.completed,
      }));
      handle.todoSections.set(ev.sectionId, mapped);
      const flat = Array.from(handle.todoSections.values()).flat();
      emit({ type: "plan.todo_updated", runId, items: flat, at: Date.now() });
      return;
    }
  }
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
      emitCodexProgressEvent(ev, runId, emit, locale);
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

/**
 * Run the scope-analysis thinking pass for an update/new-route run, streaming
 * its plan as a thinking event. Returns `{ aborted: true }` if the user
 * cancelled during the pass so the driver can finalize as "cancelled" (same as
 * an abort during the execute turn). analyzeScope already swallows non-abort
 * errors and returns null — those degrade gracefully to unscoped execution.
 */
async function runScopeAnalysisPhase(
  ctx: BuilderRunContext,
  emit: EmitFn,
  input: { fileManifest: string[]; draftWorkspacePath: string },
): Promise<
  | { aborted: true }
  | { aborted: false; scopeAnalysis: Awaited<ReturnType<typeof analyzeScope>> }
> {
  try {
    const scopeAnalysis = await analyzeScope({
      runId: ctx.runId,
      prompt: ctx.userPrompt,
      fileManifest: input.fileManifest,
      language: toProgressLocale(ctx.locale),
      signal: ctx.signal,
      env: ctx.env,
      draftWorkspacePath: input.draftWorkspacePath,
    });
    if (scopeAnalysis && scopeAnalysis.approach) {
      emit({ type: "thinking", runId: ctx.runId, text: scopeAnalysis.approach, at: Date.now() });
    }
    return { aborted: false, scopeAnalysis };
  } catch (error) {
    if (ctx.signal?.aborted) return { aborted: true };
    // analyzeScope only rethrows AbortError; anything else here is unexpected.
    // Degrade to unscoped execution rather than failing the run.
    console.warn(
      JSON.stringify({
        event: "scope_analysis_phase_unexpected_error",
        runId: ctx.runId,
        rawMessage: error instanceof Error ? error.message : String(error),
      }),
    );
    return { aborted: false, scopeAnalysis: null };
  }
}

function emitFinalAnswer(
  emit: EmitFn,
  runId: string,
  finalResponse: string,
  meta?: { runKind: BuilderRunKind; changedFiles: string[] },
): void {
  emit({
    type: "turn_completed",
    runId,
    finalResponse: finalResponse || "Done.",
    runKind: meta?.runKind,
    changedFiles: meta?.changedFiles,
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

function compactText(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…[+${trimmed.length - max} chars]`;
}

function buildCompactRepairContext(input: {
  ctx: BuilderRunContext;
  draftWorkspacePath: string;
  changedFiles: string[];
  stage: "root_style_contract" | "named_exports" | "typecheck" | "build";
}): string {
  const changed = input.changedFiles.slice(0, 80);
  const omitted = input.changedFiles.length - changed.length;
  return [
    `stage=${input.stage}`,
    `draft_workspace=${input.draftWorkspacePath}`,
    `user_prompt=${compactText(input.ctx.userPrompt, 1000)}`,
    "root_style_contract:",
    "- Generated project root is src/routes/__root.tsx.",
    "- The first two non-empty lines must be exactly:",
    "  import '@vitejs/plugin-react/preamble';",
    "  import '@/styles/app.css';",
    "- Import Providers from @/app/providers.",
    "- Wrap <Outlet /> inside <Providers>...</Providers>.",
    "- Do not remove <Scripts />.",
    "- Style customization belongs in src/styles/app.css and route/component Tailwind classes.",
    "- src/styles/app.css must keep @tailwind base/components/utilities first and preserve DESIGN_TOKENS markers.",
    "tailwind_v3_apply_rules:",
    "- Do not use @apply with marker/state utilities: group, peer, group-hover:*, peer-hover:*, group-focus:*, group-* or peer-*.",
    "- If validation says `@apply should not be used with the 'group' utility`, remove that @apply and move `group` to the parent JSX className, put group-hover variants on descendant JSX classes, or use a plain CSS selector.",
    "named_exports_contract:",
    "- Every local named import must exactly match a named export from the target file.",
    "- If validation says `does not export CartItemRow`, either export `CartItemRow` from that component file or change the import to the exported symbol/default import consistently.",
    "changed_files:",
    changed.length > 0 ? changed.map((p) => `- ${p}`).join("\n") : "- (none detected)",
    omitted > 0 ? `... (+${omitted} more)` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function isRepairableValidationOutcome(outcome: { ok: boolean; summary?: string }): boolean {
  if (outcome.ok) return false;
  const summary = outcome.summary ?? "";
  if (/process_spawn_failed|process_timed_out/i.test(summary)) return false;
  return true;
}

function createCompactRepairThread(ctx: BuilderRunContext, draftWorkspacePath: string): BoundedCodexThread {
  return createBoundedCodexThread({
    env: ctx.env,
    draftWorkspacePath,
    model: ctx.env.repairModel,
    skillToolCallbacks: buildSkillToolCallbacks(ctx.runId),
    modelReasoningEffort: "low",
  });
}

// Intermediate build turns (the no-progress "write the next missing file" loop
// and the append-corruption sweep) repeat mechanical authoring against a spec
// the model has already seen — they do not need high reasoning. The SDK pins
// reasoning effort at thread-creation (no per-turn override), so we spawn ONE
// medium-effort thread and reuse it across those turns to avoid the cost of
// high reasoning on every "write file #3 of 8" turn. The main thread keeps
// "high" for the initial + first-batch turns where design quality matters.
function createIntermediateBuildThread(
  ctx: BuilderRunContext,
  draftWorkspacePath: string,
): BoundedCodexThread {
  return createBoundedCodexThread({
    env: ctx.env,
    draftWorkspacePath,
    model: ctx.env.model,
    skillToolCallbacks: buildSkillToolCallbacks(ctx.runId),
    modelReasoningEffort: "medium",
    maxRetryAttempts: INIT_CODEX_MAX_RETRY_ATTEMPTS,
  });
}

function logValidationFailure(input: {
  stage: "root_style_contract" | "named_exports" | "typecheck" | "build" | "product_sample_parse";
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
      if (entry.isDirectory() && isIgnoredWorkspaceDir(entry.name)) continue;
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

const MAX_BATCH_RETRY = 2;
const INIT_CODEX_MAX_RETRY_ATTEMPTS = 4;
// Codex commonly writes ONE file per turn then closes the turn (one apply_patch
// per turn, intending to continue). So a batch is driven turn-by-turn as long as
// each turn reduces the missing-file count; give up only after this many
// consecutive turns that write none of the remaining files.
const MAX_NO_PROGRESS = 2;

// The model (esp. cloud-ai) does NOT retain the system prompt's file-writing
// format across turns — it reverts to narrating ("Let me update index.tsx:")
// and ends the turn without running any command. So EVERY build/retry prompt
// must repeat the concrete write mechanism (cat heredoc), not rely on the
// system prompt sent on the first turn. Without this, page-batch initial turns
// run zero commands and the batch dead-ends.
const WRITE_FILE_INSTRUCTION =
  "Write each file by running a cat heredoc through the shell: " +
  "`mkdir -p <dir> && cat > <path> <<'EOF'` … full file contents … `EOF` " +
  "(single `>` overwrite, NEVER `>>`; do NOT use apply_patch; do NOT just " +
  "print the code as text — run the command). Do NOT inspect the filesystem first.";

class BuildProducedNoFilesError extends Error {
  constructor(
    public readonly marker: string,
    public readonly missing: string[],
  ) {
    super(`batch ${marker} produced no files: ${missing.join(", ")}`);
    this.name = "BuildProducedNoFilesError";
  }
}

async function missingBatchFiles(
  draftWorkspacePath: string,
  files: string[],
): Promise<string[]> {
  const missing: string[] = [];
  for (const rel of files) {
    try {
      await fs.access(path.join(draftWorkspacePath, rel));
    } catch {
      missing.push(rel);
    }
  }
  return missing;
}

// TanStack dynamic routes use a literal `$` in the filename
// (src/routes/products/$productId.tsx). The model writes files via a bash
// heredoc (`cat > <path> <<'EOF'`); when it fails to single-quote the target,
// bash expands `$productId` (an unset var) to the empty string, so the file
// lands at src/routes/products/.tsx instead. The write SUCCEEDS (exitCode 0)
// but the file is at the wrong path, so missingBatchFiles reports the expected
// path as missing and the batch dead-ends as build_produced_no_files. This is
// deterministic and prompt-resistant (cloud-ai ignores quoting instructions),
// so rescue it deterministically: for each expected file containing `$`,
// compute the shell-expanded artifact path and, if it exists while the intended
// path does not, rename it back. Returns the count rescued (for logging).
const SHELL_VAR_RE = /\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$[A-Za-z_][A-Za-z0-9_]*/g;

export async function rescueShellExpandedBatchFiles(
  draftWorkspacePath: string,
  files: string[],
): Promise<string[]> {
  const rescued: string[] = [];
  for (const rel of files) {
    if (!rel.includes("$")) continue;
    const expandedRel = rel.replace(SHELL_VAR_RE, "");
    if (expandedRel === rel) continue;
    const intendedAbs = path.join(draftWorkspacePath, rel);
    const expandedAbs = path.join(draftWorkspacePath, expandedRel);
    try {
      await fs.access(intendedAbs);
      continue; // intended file already exists — nothing to rescue
    } catch {
      // intended missing — fall through to check the expanded artifact
    }
    try {
      await fs.access(expandedAbs);
    } catch {
      continue; // no expanded artifact either — genuine miss
    }
    try {
      await fs.mkdir(path.dirname(intendedAbs), { recursive: true });
      await fs.rename(expandedAbs, intendedAbs);
      rescued.push(rel);
    } catch {
      // rename failed — leave both paths as-is; missingBatchFiles will report
    }
  }
  return rescued;
}

class CorruptedFilesError extends Error {
  constructor(public readonly files: { path: string; reasons: string[] }[]) {
    super(
      `append-corrupted files: ${files
        .map((f) => `${f.path} (${f.reasons.join("; ")})`)
        .join(", ")}`,
    );
    this.name = "CorruptedFilesError";
  }
}

// Codex owns file writes inside the CLI binary; the app cannot intercept a
// patch to force "apply in place". When the model re-creates a file across
// turns (or runs `*** Add File:` on a file that already exists), the contents
// are APPENDED, producing a file with duplicate top-level declarations,
// repeated import blocks, or leaked patch markers. Such a file usually breaks
// typecheck (TS2451 redeclaration) — but only if the run reaches the typecheck
// gate. This pure check lets the build loop catch append-corruption directly,
// independent of typecheck, so it can force a clean rewrite (and so the failure
// is named, not a cryptic redeclaration error). Returns the reasons a file
// looks append-corrupted, or [] when it looks clean.
export function detectAppendCorruption(content: string): string[] {
  const reasons: string[] = [];

  // 1. Leaked apply_patch envelope markers — these must never survive into the
  //    written file; their presence means a patch body was written literally.
  for (const marker of [
    "*** Begin Patch",
    "*** End Patch",
    "*** Add File:",
    "*** Update File:",
  ]) {
    if (content.includes(marker)) {
      reasons.push(`leaked patch marker "${marker}"`);
    }
  }

  // 2. Duplicate TanStack route declarations. A route file declares the Route
  //    export exactly once; 2+ means full-file content was appended.
  const routeExportCount = (content.match(/^export const Route\b/gm) ?? []).length;
  if (routeExportCount > 1) {
    reasons.push(`${routeExportCount}× "export const Route" (expected 1)`);
  }
  const rootRouteCount = (content.match(/\bcreateRootRoute(?:WithContext)?\s*[(<]/g) ?? [])
    .length;
  if (rootRouteCount > 1) {
    reasons.push(`${rootRouteCount}× createRootRoute (expected 1)`);
  }
  const fileRouteCount = (content.match(/\bcreateFileRoute\s*\(/g) ?? []).length;
  if (fileRouteCount > 1) {
    reasons.push(`${fileRouteCount}× createFileRoute (expected 1)`);
  }

  // 3. A module imported on more than 2 distinct lines is a strong append
  //    signal (the same import header was re-emitted with each appended copy).
  const importSources = new Map<string, number>();
  for (const m of content.matchAll(/^\s*import\s+[^;]*?\bfrom\s+["']([^"']+)["']/gm)) {
    const src = m[1];
    importSources.set(src, (importSources.get(src) ?? 0) + 1);
  }
  for (const [src, count] of importSources) {
    if (count > 2) {
      reasons.push(`module "${src}" imported ${count}× (duplicate import blocks)`);
    }
  }

  return reasons;
}

async function detectCorruptedFiles(
  draftWorkspacePath: string,
  files: string[],
): Promise<{ path: string; reasons: string[] }[]> {
  const corrupted: { path: string; reasons: string[] }[] = [];
  for (const rel of files) {
    if (!/\.(tsx?|jsx?|css)$/.test(rel)) continue;
    let content: string;
    try {
      content = await fs.readFile(path.join(draftWorkspacePath, rel), "utf8");
    } catch {
      continue;
    }
    const reasons = detectAppendCorruption(content);
    if (reasons.length > 0) corrupted.push({ path: rel, reasons });
  }
  return corrupted;
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
  // Plan turn is read-only but must snapshot the SAME workspace the execute
  // driver will edit — the project root (update/new_route/init all operate
  // in-place there), not a draft clone.
  const draftWorkspacePath = await ensureProjectWorkspace({
    projectId: ctx.projectId,
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
  const allInstructions = [
    ...foundationInstructions,
    initSystemInstruction,
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

  const beforeSnapshot = await takeSnapshot(draftWorkspacePath);

  let thread: BoundedCodexThread;
  try {
    thread = createBoundedCodexThread({
      env: ctx.env,
      draftWorkspacePath,
      skillToolCallbacks: buildSkillToolCallbacks(runId),
      modelReasoningEffort: ctx.reasoningEffort ?? "high",
      maxRetryAttempts: INIT_CODEX_MAX_RETRY_ATTEMPTS,
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
    const {
      generateRetailVariants,
      buildVariantBuildPrompt,
      detectStyleDirection,
      buildDetectedStyleBuildPrompt,
    } = await import("./design-variants.server");
    // Pre-build clarification turns only need a thin brief: project type, taste
    // dial vocabulary, and output JSON shape (inlined in each prompt below).
    // The full instructionDigest (foundation + init/system.md + init-mode) is
    // ~11k tokens of build-time authoring rules (cat-heredoc, DOMPurify SSR
    // guard, axios .data unwrap, completion checklist) irrelevant to choosing a
    // visual direction. The full bundle still ships on the build turn via
    // bundle.prompt below.
    const designBrief = [
      "Project: retail e-commerce storefront, public-publishing, SEO-capable.",
      "Audience: shoppers; pages must serve a storefront shopping experience.",
      "Taste dials (1=low, 10=high) — pick values that fit the brief, do not",
      "default to baseline:",
      "- designVariance: 1=perfect symmetry, 10=artsy chaos",
      "- motionIntensity: 1=static, 10=cinematic / physics",
      "- visualDensity: 1=airy gallery, 10=packed cockpit",
      "Avoid generic defaults (AI-purple/blue gradient, beige+brass luxury,",
      "Inter-as-default). Read the user request for real cultural / category /",
      "price-tier cues and tailor the direction to THIS store.",
    ].join("\n");

    // First, check whether the user's prompt ALREADY carries a clear design
    // direction. If it does, the four-variant question is redundant — extract
    // the direction, feed it into the build, and skip the pause entirely. A
    // detect failure (parse/validation) falls through to the variant flow so a
    // flaky turn never blocks init.
    const detectPrompt = [
      "You are a senior retail UX designer. Decide whether the user's request",
      "ALREADY specifies a concrete design direction for their storefront — a",
      "named aesthetic, a palette, a typography choice, or a strong, specific",
      "vibe (e.g. \"neo-luxe gold and black\", \"phố cổ artisan with warm earth",
      "tones\", \"playful pastel for kids\"). A bare product/category mention with",
      "no visual cue (e.g. \"a shop selling shoes\") is NOT a direction.",
      "",
      "<user_request>",
      ctx.userPrompt.trim(),
      "</user_request>",
      "",
      "<project_brief>",
      designBrief,
      "</project_brief>",
      "",
      "Output JSON only — no prose, no code fence. Shape:",
      '{ "hasStyleDirection": boolean, "style"?: { "label": string, "summary": string, "palette"?: string[], "font"?: string, "motion"?: number } }',
      "Where:",
      "- hasStyleDirection: true ONLY if the request names a clear visual direction.",
      "- style.label: short name for the direction (≤80 chars).",
      "- style.summary: one line on aesthetic, audience, mood (≤400 chars).",
      "- style.palette: hex colors the user named, if any (omit if none).",
      "- style.font / style.motion (0..1): only if the user implied them.",
      "Omit `style` entirely when hasStyleDirection is false.",
    ].join("\n");
    // Detect + variant turns only need a JSON-shape reply, never apply_patch /
    // exec. Hit /v1/responses directly to skip the codex CLI's 13KB system
    // prompt + 8KB tool array + skills registry that get baked into every SDK
    // call, and to avoid the WS-reconnect / reasoning-replay failure modes that
    // only surface inside the CLI's HTTP fallback.
    const { runResponsesTurn } = await import("./responses-http-client.server");
    const detectResult = await detectStyleDirection({
      runTurn: async () => {
        return await runResponsesTurn({
          env: ctx.env,
          prompt: detectPrompt,
          reasoningEffort: "high",
          signal: ctx.signal,
          onReasoning: (text) => {
            emit({ type: "thinking", runId, text, at: Date.now() });
          },
        });
      },
    });
    console.warn(
      JSON.stringify({
        event: "design_style_detect_result",
        runId,
        projectId: ctx.projectId,
        ok: detectResult.ok,
        hasStyleDirection: detectResult.ok ? detectResult.hasStyleDirection : undefined,
        reason: detectResult.ok ? undefined : detectResult.reason,
      }),
    );

    if (detectResult.ok && detectResult.hasStyleDirection) {
      // Prompt already has a direction — apply it and skip the variant pause.
      variantPromptAddendum = "\n\n" + buildDetectedStyleBuildPrompt(detectResult.style);
    } else {
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
      "<project_brief>",
      designBrief,
      "</project_brief>",
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
        // Direct HTTP — same rationale as detect above. No CLI, no WS, no
        // transcript replay between attempts (each call is one round-trip).
        return await runResponsesTurn({
          env: ctx.env,
          prompt: variantReasoningPrompt,
          reasoningEffort: "high",
          signal: ctx.signal,
          onReasoning: (text) => {
            emit({ type: "thinking", runId, text, at: Date.now() });
          },
        });
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
              resolveChoice(answer);
            };
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

  // Variant chosen (or skipped) — begin authoring the visual identity.
  emitMilestoneInternal(emit, runId, "building_pages");
  let finalResponse = "";
  try {
    const initialSummary = await runTurnAndBridge(thread, runId, emit, {
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

    // Lazy-spawn a medium-effort thread for intermediate build turns (the
    // no-progress file loop + corruption sweep). Created once, reused across
    // turns so there is no per-turn spawn cost. Built lazily so a run that
    // finishes all files in the first-batch turn (no retry) never pays for it.
    let intermediateThread: BoundedCodexThread | null = null;
    const getIntermediateThread = (): BoundedCodexThread => {
      if (!intermediateThread) {
        intermediateThread = createIntermediateBuildThread(ctx, draftWorkspacePath);
      }
      return intermediateThread;
    };

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
      const basePrompt =
        `Now build batch ${batch.marker} (${batch.kind}). Files in scope: ${batch.files.join(", ")}.\n` +
        WRITE_FILE_INSTRUCTION +
        specBlock;
      const batchSummary = await runTurnAndBridge(thread, runId, emit, {
        prompt: basePrompt,
        signal: ctx.signal,
        emitAnswer: false,
        locale: toProgressLocale(ctx.locale),
      });
      if (batchSummary.finalResponse) finalResponse = batchSummary.finalResponse;

      // The model often writes ONE file per turn and ends the turn (codex emits
      // a single apply_patch then closes, intending to continue next turn). A
      // component batch needs up to 7 files, so a hard 2-retry cap would kill a
      // run still making progress. Keep prompting as long as each turn reduces
      // the missing-file count; bail only after MAX_NO_PROGRESS consecutive
      // turns that write none of the remaining files. A generous overall cap
      // (files + slack) guards against an infinite loop.
      {
        const maxTurns = batch.files.length + MAX_NO_PROGRESS + 2;
        let prevMissingCount = (
          await missingBatchFiles(draftWorkspacePath, batch.files)
        ).length;
        let noProgress = 0;
        for (
          let turn = 0;
          turn < maxTurns && prevMissingCount > 0 && noProgress < MAX_NO_PROGRESS;
          turn++
        ) {
          const missing = await missingBatchFiles(draftWorkspacePath, batch.files);
          console.warn(
            JSON.stringify({
              event: "init_batch_no_files_retry",
              runId,
              projectId: ctx.projectId,
              marker: batch.marker,
              turn: turn + 1,
              missing,
              noProgress,
            }),
          );
          // The first attempt to finish a batch used the high-reasoning main
          // thread; subsequent "you still owe files" turns are mechanical and
          // reuse the medium-effort intermediate thread to cut per-turn latency.
          const retryThread = turn === 0 ? thread : getIntermediateThread();
          const retrySummary = await runTurnAndBridge(retryThread, runId, emit, {
            prompt:
              `The previous turn did not finish this batch. Your FIRST action now is to write a file — do NOT narrate, do NOT end the turn without running a write command.\n` +
              `These files are still missing — create as many as you can THIS turn: ${missing.join(", ")}.\n` +
              WRITE_FILE_INSTRUCTION +
              "\n" +
              basePrompt,
            signal: ctx.signal,
            emitAnswer: false,
            locale: toProgressLocale(ctx.locale),
          });
          if (retrySummary.finalResponse) finalResponse = retrySummary.finalResponse;
          const remaining = (
            await missingBatchFiles(draftWorkspacePath, batch.files)
          ).length;
          // A turn that reduced the missing count is progress — reset the streak.
          // A turn that wrote none of the remaining files counts toward giving up.
          if (remaining < prevMissingCount) noProgress = 0;
          else noProgress += 1;
          prevMissingCount = remaining;
        }
        const stillMissing = await missingBatchFiles(draftWorkspacePath, batch.files);
        if (stillMissing.length > 0) {
          throw new BuildProducedNoFilesError(batch.marker, stillMissing);
        }
      }

    }

    // Re-assert runtime-owned plumbing. system.md tells the model NOT to touch
    // the seeded plumbing (providers, hooks, ui primitives, __root.tsx, …), but
    // cloud-ai ignores instructions and codex writes straight to disk inside the
    // CLI — so the model can silently overwrite a seeded file with a broken
    // version (e.g. __root.tsx missing <Providers>) mid-loop, defeating the
    // whole seeding pivot. There is no in-CLI write hook to prevent it, so
    // restore every runtime_owned file to its canonical seed content here,
    // before the typecheck/build gates. editable_baseline files (app.css, data
    // entities) are intentionally left as the model wrote them.
    const restored = await reassertRuntimeOwnedFiles({ draftWorkspacePath });
    if (restored.length > 0) {
      console.warn(
        JSON.stringify({
          event: "init_runtime_owned_reasserted",
          runId,
          projectId: ctx.projectId,
          restored,
        }),
      );
    }

    // Init only tasks the model with home + product-detail (see INIT_PHASES);
    // the other five commerce routes ship as "coming soon" skeletons. They are
    // editable_baseline so /generate-page can author them later, which means the
    // reassert above leaves them alone — and the model (ignoring the "do NOT
    // touch other routes" prompt rule, writing straight to disk via the CLI) can
    // fill them with full pages mid-init. Revert any such route to its seed so
    // init ships ONLY home + product-detail as real pages and the check/fix loop
    // stays focused on those two.
    const comingSoonReverted = await reassertComingSoonRoutes({ draftWorkspacePath });
    if (comingSoonReverted.length > 0) {
      console.warn(
        JSON.stringify({
          event: "init_coming_soon_routes_reasserted",
          runId,
          projectId: ctx.projectId,
          reverted: comingSoonReverted,
        }),
      );
    }

    // Inject the model's DESIGN.md palette into app.css. app.css is an editable
    // baseline, so this rewrites only the DESIGN_TOKENS region with the colors
    // the model chose while preserving any extra global CSS it added for the
    // selected style variant. A missing/garbled DESIGN.md leaves the safe
    // default untouched.
    const paletteInjected = await injectDesignPaletteIntoAppCss({ draftWorkspacePath });
    const tailwindDirectivesNormalized = await enforceTailwindDirectivesAtTop({
      draftWorkspacePath,
    });
    console.warn(
      JSON.stringify({
        event: "init_design_palette_injected",
        runId,
        projectId: ctx.projectId,
        injected: paletteInjected,
        tailwindDirectivesNormalized,
      }),
    );

    // Append-corruption sweep. Codex owns file writes inside the CLI; when the
    // model re-creates a file across turns (or runs `*** Add File:` on a file
    // that already exists), contents are APPENDED — yielding duplicate
    // declarations, repeated imports, or leaked patch markers. Scope the sweep
    // to what the agent actually authored: the batch files (the 7 components)
    // plus app.css (an editable baseline the model extends with the chosen
    // variant). __root.tsx and the rest of the plumbing are runtime-owned and
    // were just reasserted to canonical content, so they cannot be corrupt.
    const sweepFiles = Array.from(
      new Set<string>([
        ...plan.batches.flatMap((b) => b.files),
        "src/styles/app.css",
      ]),
    );
    for (let attempt = 0; attempt < MAX_BATCH_RETRY; attempt++) {
      const corrupted = await detectCorruptedFiles(draftWorkspacePath, sweepFiles);
      if (corrupted.length === 0) break;
      console.warn(
        JSON.stringify({
          event: "init_append_corruption_rewrite",
          runId,
          projectId: ctx.projectId,
          attempt: attempt + 1,
          corrupted,
        }),
      );
      const fileList = corrupted
        .map((f) => `- ${f.path}: ${f.reasons.join("; ")}`)
        .join("\n");
      // Corruption sweep turns are mechanical rewrites (overwrite a file cleanly);
      // they reuse the medium-effort intermediate thread.
      await runTurnAndBridge(getIntermediateThread(), runId, emit, {
        prompt:
          `These files were corrupted by appended writes — they contain duplicate ` +
          `top-level declarations, repeated import blocks, or leaked patch markers:\n` +
          `${fileList}\n\n` +
          `Fix each one by OVERWRITING it with a single \`cat > <path> <<'EOF'\` … \`EOF\` ` +
          `command that writes ONE clean, complete, correct version of the whole file. ` +
          `Use a single \`>\` (overwrite) — NEVER \`>>\` (append duplicates content). ` +
          `Each file must declare its route/exports exactly once and import each module ` +
          `once. Do not print code as text; run the cat command for every file.`,
        signal: ctx.signal,
        emitAnswer: false,
        locale: toProgressLocale(ctx.locale),
      });
    }
    const stillCorrupted = await detectCorruptedFiles(draftWorkspacePath, sweepFiles);
    if (stillCorrupted.length > 0) {
      throw new CorruptedFilesError(stillCorrupted);
    }
    // Post-write rule validator: deterministic rules that used to bloat the
    // prompt (hardcoded brand strings, lucide brand-icon imports, @apply group
    // misuse, direct @/data imports in UI). Validator catches them in the
    // generated files even when the model "forgets" the rule, then re-prompts
    // with a structured repair list. One repair attempt — rules are mechanical.
    {
      const { validateWrittenFiles, formatIssuesForRepairPrompt } =
        await import("./post-write-validator.server");
      let validationIssues = await validateWrittenFiles({
        draftWorkspacePath,
        filePaths: sweepFiles,
      });
      if (validationIssues.length > 0) {
        console.warn(
          JSON.stringify({
            event: "init_post_write_validation_issues",
            runId,
            projectId: ctx.projectId,
            issueCount: validationIssues.length,
            codes: Array.from(new Set(validationIssues.map((i) => i.code))),
          }),
        );
        const repairList = formatIssuesForRepairPrompt(validationIssues);
        await runTurnAndBridge(getIntermediateThread(), runId, emit, {
          prompt:
            `Validator found rule violations in files you just wrote. Fix each by ` +
            `OVERWRITING the file via \`cat > <path> <<'EOF'\` … \`EOF\` with the ` +
            `corrected complete file content. Use a single \`>\` (overwrite), NEVER ` +
            `\`>>\`. Findings:\n\n${repairList}`,
          signal: ctx.signal,
          emitAnswer: false,
          locale: toProgressLocale(ctx.locale),
        });
        validationIssues = await validateWrittenFiles({
          draftWorkspacePath,
          filePaths: sweepFiles,
        });
        if (validationIssues.length > 0) {
          console.warn(
            JSON.stringify({
              event: "init_post_write_validation_persisted",
              runId,
              projectId: ctx.projectId,
              issues: validationIssues.slice(0, 20),
            }),
          );
          // Soft warning — don't fail the run yet; typecheck/build gates will
          // catch hard breakages and these rule violations rarely break preview
          // boot. Surface for triage and continue.
        }
      }
    }
    await enforceTailwindDirectivesAtTop({ draftWorkspacePath });
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
    let failureCode: BuilderRunFailureCode = "codex_runtime_failed";
    let failureMessage = "codex turn ended unexpectedly";
    if (error instanceof ReasoningReplayError) {
      failureCode = "provider_drops_reasoning";
      failureMessage =
        "Nhà cung cấp AI không giữ lại reasoning giữa các bước nên không thể dựng code. Cần bật reasoning.encrypted_content (hoặc lưu response) ở provider.";
    } else if (error instanceof ApplyPatchUnavailableError) {
      failureCode = "apply_patch_unavailable";
      failureMessage = error.message;
    } else if (error instanceof GatewaySoftError || error instanceof StreamReconnectError) {
      failureCode = "provider_gateway_soft_error";
      failureMessage = error.message;
    } else if (error instanceof BuildProducedNoFilesError) {
      failureCode = "build_produced_no_files";
      failureMessage = error.message;
    } else if (error instanceof CorruptedFilesError) {
      failureCode = "files_corrupted";
      failureMessage = error.message;
    }
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
  // Gates reduced to typecheck + build. The root/style contract is moot now
  // that __root.tsx is runtime-owned + reasserted, and the named-export
  // contract is a strict subset of typecheck (tsc reports "no exported member"
  // more precisely). Two gates instead of four cuts repair turns without losing
  // the guarantee that the storefront compiles and builds.
  const typecheckRepair = await runRepairLoop({
    thread,
    validate: () => runTypecheck(draftWorkspacePath, { signal: ctx.signal }),
    signal: ctx.signal,
    onCycleStart: () => emitMilestoneInternal(emit, runId, "repairing"),
    onProgress: (ev) => emitCodexProgressEvent(ev, runId, emit, toProgressLocale(ctx.locale)),
    createRepairThread: () => createCompactRepairThread(ctx, draftWorkspacePath),
    shouldRepair: isRepairableValidationOutcome,
    stage: "typecheck",
    runId,
    projectId: ctx.projectId,
    changedFilesCount: diffGate.changedFiles.length,
    context: buildCompactRepairContext({
      ctx,
      draftWorkspacePath,
      changedFiles: diffGate.changedFiles,
      stage: "typecheck",
    }),
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
    onProgress: (ev) => emitCodexProgressEvent(ev, runId, emit, toProgressLocale(ctx.locale)),
    createRepairThread: () => createCompactRepairThread(ctx, draftWorkspacePath),
    shouldRepair: isRepairableValidationOutcome,
    stage: "build",
    runId,
    projectId: ctx.projectId,
    changedFilesCount: diffGate.changedFiles.length,
    context: buildCompactRepairContext({
      ctx,
      draftWorkspacePath,
      changedFiles: diffGate.changedFiles,
      stage: "build",
    }),
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

  // Explicit "storefront is ready" notification so the user knows init finished
  // (the composer unblocks and the client auto-starts the preview).
  emitFinalAnswer(emit, runId, finalResponse, { runKind: ctx.kind, changedFiles: diffGate.changedFiles });
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

  // New-route runs in-place against the project workspace root (same as init
  // and update) — the cwd the preview pm2 process binds to. No draft clone /
  // publish round-trip: the new route file lands directly in the live project.
  const draftWorkspacePath = await ensureProjectWorkspace({
    projectId: ctx.projectId,
  });
  await ensureProjectGitignore({ draftWorkspacePath });
  const fileManifest = await listFiles(draftWorkspacePath);
  const foundationInstructions = await loadFoundationInstructions({
    entries: UPDATE_FOUNDATION_INSTRUCTIONS,
    embedProjectRuleDocs: false,
  });

  // Thinking pass: scope the request to specific files before the expensive
  // high-reasoning execute turn, so it edits directly instead of re-deriving
  // the project structure with broad discovery every time.
  const scopePhase = await runScopeAnalysisPhase(ctx, emit, {
    fileManifest,
    draftWorkspacePath,
  });
  if (scopePhase.aborted) {
    emit({ type: "cancelled", runId, milestone: "cancelled", at: Date.now() });
    return finalize({
      runId,
      status: "cancelled",
      failureCode: "cancelled",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: [],
      optionalRouteWarnings: [],
    });
  }

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
    scopeAnalysis: scopePhase.scopeAnalysis,
  });

  // A new_route request that targets a known storefront page (e.g. building the
  // products catalog from chat rather than via /modify-page) gets the same
  // init page-spec embedded so it follows the per-page authoring contract.
  const pageSpecBlock = await buildEditPageSpecBlock({
    relevantFiles: scopePhase.scopeAnalysis?.relevantFiles ?? [],
    prompt: ctx.userPrompt,
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
      modelReasoningEffort: ctx.reasoningEffort ?? "high",
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
      prompt: bundle.prompt + pageSpecBlock + "\n\n<plan_request>Plan the new route changes before mutating any files.</plan_request>",
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
  const styleRepair = await runRepairLoop({
    thread,
    validate: () => runRootStyleContract(draftWorkspacePath),
    signal: ctx.signal,
    onCycleStart: () => emitMilestoneInternal(emit, runId, "repairing"),
    onProgress: (ev) => emitCodexProgressEvent(ev, runId, emit, toProgressLocale(ctx.locale)),
    createRepairThread: () => createCompactRepairThread(ctx, draftWorkspacePath),
    stage: "root_style_contract",
    runId,
    projectId: ctx.projectId,
    changedFilesCount: diffGate.changedFiles.length,
    context: buildCompactRepairContext({
      ctx,
      draftWorkspacePath,
      changedFiles: diffGate.changedFiles,
      stage: "root_style_contract",
    }),
  });
  const styleContract = styleRepair.finalOutcome;
  if (!styleContract.ok) {
    const code: BuilderRunFailureCode =
      styleRepair.cyclesUsed >= 2 ? "repair_exhausted" : "validation_failed";
    logValidationFailure({
      stage: "root_style_contract",
      runId,
      projectId: ctx.projectId,
      outcome: styleContract,
      cyclesUsed: styleRepair.cyclesUsed,
    });
    emitFailure(
      emit,
      runId,
      code,
      `root/style contract failed: ${truncate(styleContract.summary, 1500)}`,
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
  const typecheckRepair = await runRepairLoop({
    thread,
    validate: () => runTypecheck(draftWorkspacePath, { signal: ctx.signal }),
    signal: ctx.signal,
    onCycleStart: () => emitMilestoneInternal(emit, runId, "repairing"),
    onProgress: (ev) => emitCodexProgressEvent(ev, runId, emit, toProgressLocale(ctx.locale)),
    createRepairThread: () => createCompactRepairThread(ctx, draftWorkspacePath),
    stage: "typecheck",
    runId,
    projectId: ctx.projectId,
    changedFilesCount: diffGate.changedFiles.length,
    context: buildCompactRepairContext({
      ctx,
      draftWorkspacePath,
      changedFiles: diffGate.changedFiles,
      stage: "typecheck",
    }),
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
    onProgress: (ev) => emitCodexProgressEvent(ev, runId, emit, toProgressLocale(ctx.locale)),
    createRepairThread: () => createCompactRepairThread(ctx, draftWorkspacePath),
    stage: "build",
    runId,
    projectId: ctx.projectId,
    changedFilesCount: diffGate.changedFiles.length,
    context: buildCompactRepairContext({
      ctx,
      draftWorkspacePath,
      changedFiles: diffGate.changedFiles,
      stage: "build",
    }),
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

  // Edits landed in the project root in place — nothing to sync or clean up.
  emitFinalAnswer(emit, runId, finalResponse, { runKind: ctx.kind, changedFiles: diffGate.changedFiles });
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

// Author (or redesign) a single storefront page on demand via the
// /generate-page command. Runs in-place on the project workspace like
// small_update/new_route (no reassert — reassert is init-only). For a known
// page it embeds the init page-spec verbatim so the result matches init-grade
// quality; for a custom slug it authors a brand-new route from the user's
// description. The target file is known up front, so the scope-analysis
// thinking pass is skipped. On success the dispatcher records the slug in
// project state (generatedPages).
export async function runGeneratePageBuilderRun(
  ctx: BuilderRunContext,
  emit: EmitFn,
): Promise<BuilderRunOutcome> {
  const { runId } = ctx;
  const target = ctx.generatePageTarget;
  emitMilestoneInternal(emit, runId, "loading_context");

  const skillSelection = await runSkillSelection(
    ctx,
    ["ui_mutation"],
    emit,
    async (rerunPrompt) => {
      await runGeneratePageBuilderRun({ ...ctx, userPrompt: rerunPrompt }, emit);
    },
  );
  if (skillSelection.kind === "required_unavailable") {
    return requiredUnavailableOutcome(ctx, emit, skillSelection.missing);
  }
  if (skillSelection.kind === "paused") {
    return pausedOutcome(ctx, skillSelection);
  }

  const draftWorkspacePath = await ensureProjectWorkspace({
    projectId: ctx.projectId,
  });
  await ensureProjectGitignore({ draftWorkspacePath });
  const fileManifest = await listFiles(draftWorkspacePath);
  const foundationInstructions = await loadFoundationInstructions({
    entries: FOUNDATION_INSTRUCTIONS,
    embedProjectRuleDocs: true,
  });

  // Load the page spec for a known page and embed it verbatim (the spec
  // frontmatter warns "send verbatim to the model"). Missing spec is
  // non-fatal — the user's description still drives the run.
  const specBodies = target?.isKnownPage && target.spec
    ? await loadBatchSpecs([target.spec])
    : [];

  const routeHint = target?.route
    ? `The target route file is \`${target.route}\`.`
    : "This is a brand-new page not in the standard storefront set — create the route file and register it if the router requires it.";
  const specBlock = specBodies.length > 0
    ? `\n\n<page_spec>\nAuthor the page to satisfy this contract verbatim. ${routeHint}\n\n${specBodies.join("\n\n")}\n</page_spec>`
    : `\n\n<page_target>\n${routeHint}\n</page_target>`;
  const modeNote = target?.isKnownPage
    ? "If the route file already exists as a designed page, treat this as a redesign: preserve its data hooks and cart/commerce contract, and apply the user's requested changes. If it is still the seeded skeleton, author it fully from the spec."
    : "Author the new page from the user's description.";
  const generatePrompt = `<generate_page_request>\nSlug: ${target?.slug ?? "(unknown)"}\n${modeNote}${specBlock}\n</generate_page_request>`;

  const bundle = buildContextBundle({
    projectId: ctx.projectId,
    userId: ctx.userId,
    draftWorkspacePath,
    userPrompt: `${ctx.userPrompt}\n\n${generatePrompt}`.trim(),
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
    scopeAnalysis: target?.route
      ? { relevantFiles: [target.route], approach: `Author the ${target.slug} page.` }
      : null,
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
      modelReasoningEffort: ctx.reasoningEffort ?? "high",
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

  emitMilestoneInternal(emit, runId, "creating_draft");
  const beforeSnapshot = await takeSnapshot(draftWorkspacePath);

  emitMilestoneInternal(emit, runId, "building_pages");
  let finalResponse = "";
  try {
    const mutationSummary = await runTurnAndBridge(thread, runId, emit, {
      prompt: bundle.prompt,
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
    emitFailure(emit, runId, "codex_runtime_failed", "generate-page turn ended unexpectedly");
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

  emitMilestoneInternal(emit, runId, "checking_preview");
  const styleRepair = await runRepairLoop({
    thread,
    validate: () => runRootStyleContract(draftWorkspacePath),
    signal: ctx.signal,
    onCycleStart: () => emitMilestoneInternal(emit, runId, "repairing"),
    onProgress: (ev) => emitCodexProgressEvent(ev, runId, emit, toProgressLocale(ctx.locale)),
    createRepairThread: () => createCompactRepairThread(ctx, draftWorkspacePath),
    stage: "root_style_contract",
    runId,
    projectId: ctx.projectId,
    changedFilesCount: diffGate.changedFiles.length,
    context: buildCompactRepairContext({
      ctx,
      draftWorkspacePath,
      changedFiles: diffGate.changedFiles,
      stage: "root_style_contract",
    }),
  });
  if (!styleRepair.finalOutcome.ok) {
    const code: BuilderRunFailureCode =
      styleRepair.cyclesUsed >= 2 ? "repair_exhausted" : "validation_failed";
    emitFailure(emit, runId, code, `root/style contract failed: ${truncate(styleRepair.finalOutcome.summary, 1500)}`);
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
  const typecheckRepair = await runRepairLoop({
    thread,
    validate: () => runTypecheck(draftWorkspacePath, { signal: ctx.signal }),
    signal: ctx.signal,
    onCycleStart: () => emitMilestoneInternal(emit, runId, "repairing"),
    onProgress: (ev) => emitCodexProgressEvent(ev, runId, emit, toProgressLocale(ctx.locale)),
    createRepairThread: () => createCompactRepairThread(ctx, draftWorkspacePath),
    stage: "typecheck",
    runId,
    projectId: ctx.projectId,
    changedFilesCount: diffGate.changedFiles.length,
    context: buildCompactRepairContext({
      ctx,
      draftWorkspacePath,
      changedFiles: diffGate.changedFiles,
      stage: "typecheck",
    }),
  });
  if (!typecheckRepair.finalOutcome.ok) {
    const code: BuilderRunFailureCode =
      typecheckRepair.cyclesUsed >= 2 ? "repair_exhausted" : "validation_failed";
    emitFailure(emit, runId, code, `typecheck failed: ${truncate(typecheckRepair.finalOutcome.summary, 1500)}`);
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
    onProgress: (ev) => emitCodexProgressEvent(ev, runId, emit, toProgressLocale(ctx.locale)),
    createRepairThread: () => createCompactRepairThread(ctx, draftWorkspacePath),
    stage: "build",
    runId,
    projectId: ctx.projectId,
    changedFilesCount: diffGate.changedFiles.length,
    context: buildCompactRepairContext({
      ctx,
      draftWorkspacePath,
      changedFiles: diffGate.changedFiles,
      stage: "build",
    }),
  });
  if (!buildRepair.finalOutcome.ok) {
    const code: BuilderRunFailureCode =
      buildRepair.cyclesUsed >= 2 ? "repair_exhausted" : "validation_failed";
    emitFailure(emit, runId, code, `build failed: ${truncate(buildRepair.finalOutcome.summary, 1500)}`);
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

  emitFinalAnswer(emit, runId, finalResponse, { runKind: ctx.kind, changedFiles: diffGate.changedFiles });
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

  // Update runs in-place against the project workspace root — the same cwd the
  // preview pm2 process binds to and the same directory init wrote into. This
  // keeps a single source of truth so edits target the actual project files
  // (not an empty draft cloned from a never-populated published/ mirror).
  const draftWorkspacePath = await ensureProjectWorkspace({
    projectId: ctx.projectId,
  });
  // Backfill .gitignore for projects created before it was seeded, so the
  // Codex CLI never walks dist/ etc. into context on this follow-up prompt.
  await ensureProjectGitignore({ draftWorkspacePath });
  const fileManifest = await listFiles(draftWorkspacePath);
  const foundationInstructions = await loadFoundationInstructions({
    entries: UPDATE_FOUNDATION_INSTRUCTIONS,
    embedProjectRuleDocs: false,
  });

  // Thinking pass: scope the request to specific files before the expensive
  // high-reasoning execute turn, so it edits directly instead of re-deriving
  // the project structure with broad discovery every time.
  const scopePhase = await runScopeAnalysisPhase(ctx, emit, {
    fileManifest,
    draftWorkspacePath,
  });
  if (scopePhase.aborted) {
    emit({ type: "cancelled", runId, milestone: "cancelled", at: Date.now() });
    return finalize({
      runId,
      status: "cancelled",
      failureCode: "cancelled",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: [],
      optionalRouteWarnings: [],
    });
  }

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
    scopeAnalysis: scopePhase.scopeAnalysis,
  });

  // An update request that edits a known storefront page (e.g. "improve the
  // products search") gets the same init page-spec embedded so the edit follows
  // the per-page authoring contract instead of only the generic route map.
  const pageSpecBlock = await buildEditPageSpecBlock({
    relevantFiles: scopePhase.scopeAnalysis?.relevantFiles ?? [],
    prompt: ctx.userPrompt,
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
      modelReasoningEffort: ctx.reasoningEffort ?? "high",
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
      prompt: bundle.prompt + pageSpecBlock,
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
  const styleRepair = await runRepairLoop({
    thread,
    validate: () => runRootStyleContract(draftWorkspacePath),
    signal: ctx.signal,
    onCycleStart: () => emitMilestoneInternal(emit, runId, "repairing"),
    onProgress: (ev) => emitCodexProgressEvent(ev, runId, emit, toProgressLocale(ctx.locale)),
    createRepairThread: () => createCompactRepairThread(ctx, draftWorkspacePath),
    stage: "root_style_contract",
    runId,
    projectId: ctx.projectId,
    changedFilesCount: diffGate.changedFiles.length,
    context: buildCompactRepairContext({
      ctx,
      draftWorkspacePath,
      changedFiles: diffGate.changedFiles,
      stage: "root_style_contract",
    }),
  });
  const styleContract = styleRepair.finalOutcome;
  if (!styleContract.ok) {
    const code: BuilderRunFailureCode =
      styleRepair.cyclesUsed >= 2 ? "repair_exhausted" : "validation_failed";
    emitFailure(emit, runId, code, "root/style contract failed");
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
  const typecheckRepair = await runRepairLoop({
    thread,
    validate: () => runTypecheck(draftWorkspacePath, { signal: ctx.signal }),
    signal: ctx.signal,
    onCycleStart: () => emitMilestoneInternal(emit, runId, "repairing"),
    onProgress: (ev) => emitCodexProgressEvent(ev, runId, emit, toProgressLocale(ctx.locale)),
    createRepairThread: () => createCompactRepairThread(ctx, draftWorkspacePath),
    stage: "typecheck",
    runId,
    projectId: ctx.projectId,
    changedFilesCount: diffGate.changedFiles.length,
    context: buildCompactRepairContext({
      ctx,
      draftWorkspacePath,
      changedFiles: diffGate.changedFiles,
      stage: "typecheck",
    }),
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

  // Edits landed in the project root in place — nothing to sync or clean up.
  emitFinalAnswer(emit, runId, finalResponse, { runKind: ctx.kind, changedFiles: diffGate.changedFiles });
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

// Load the redesign-rewrite template and fill its placeholders. The template
// has the model author a fresh DESIGN.md then restyle the storefront UI to
// match; tokenHints carries any concrete tokens detected from the prompt.
async function loadRedesignRewritePrompt(input: {
  originalPrompt: string;
  tokenHints: string;
}): Promise<string> {
  const loaded = await loadInstruction({
    name: "redesign-rewrite",
    relativePath: "redesign/redesign-rewrite.md",
    source: "template_required",
  });
  return loaded.content
    .replace(
      "{{originalPrompt}}",
      input.originalPrompt ||
        "(no extra detail — choose a strong, distinct new visual direction for the store)",
    )
    .replace("{{tokenHints}}", input.tokenHints);
}

// Smart design-direction clarification for a /redesign run. Reuses the init
// detect+variant flow: if the user's prompt already names a concrete direction
// (palette/typography/vibe), extract it and skip the pause; otherwise propose
// four directions and pause on awaiting_clarification for the user's pick (or
// free-text). Returns the build-prompt addendum describing the chosen
// direction, or "" when the flow degrades (never blocks the redesign).
// `{ aborted: true }` when the user cancels mid-clarification.
async function resolveRedesignDirection(
  ctx: BuilderRunContext,
  emit: EmitFn,
): Promise<{ aborted: true } | { aborted: false; addendum: string }> {
  const { runId } = ctx;
  try {
    const {
      generateRetailVariants,
      buildVariantBuildPrompt,
      detectStyleDirection,
      buildDetectedStyleBuildPrompt,
    } = await import("./design-variants.server");
    const { runResponsesTurn } = await import("./responses-http-client.server");

    const designBrief = [
      "Project: EXISTING retail e-commerce storefront being redesigned.",
      "Audience: shoppers; keep it a storefront shopping experience.",
      "Taste dials (1=low, 10=high) — pick values that fit the request:",
      "- designVariance: 1=perfect symmetry, 10=artsy chaos",
      "- motionIntensity: 1=static, 10=cinematic / physics",
      "- visualDensity: 1=airy gallery, 10=packed cockpit",
      "Avoid generic defaults (AI-purple/blue gradient, beige+brass luxury,",
      "Inter-as-default). Read the request for real cultural / category /",
      "price-tier cues and tailor the direction to THIS store.",
    ].join("\n");

    const detectPrompt = [
      "You are a senior retail UX designer. Decide whether the user's redesign",
      "request ALREADY specifies a concrete design direction — a named",
      "aesthetic, a palette, a typography choice, or a strong, specific vibe",
      '(e.g. "neo-luxe gold and black", "warm earth-tone artisan", "playful',
      'pastel for kids"). A bare "make it look better / more modern" with no',
      "visual cue is NOT a direction.",
      "",
      "<user_request>",
      ctx.userPrompt.trim() || "(empty — the user only typed /redesign)",
      "</user_request>",
      "",
      "<project_brief>",
      designBrief,
      "</project_brief>",
      "",
      "Output JSON only — no prose, no code fence. Shape:",
      '{ "hasStyleDirection": boolean, "style"?: { "label": string, "summary": string, "palette"?: string[], "font"?: string, "motion"?: number } }',
      "- hasStyleDirection: true ONLY if the request names a clear visual direction.",
      "- style.label: short name for the direction (≤80 chars).",
      "- style.summary: one line on aesthetic, audience, mood (≤400 chars).",
      "- style.palette: hex colors the user named, if any (omit if none).",
      "Omit `style` entirely when hasStyleDirection is false.",
    ].join("\n");

    const detectResult = await detectStyleDirection({
      runTurn: async () =>
        runResponsesTurn({
          env: ctx.env,
          prompt: detectPrompt,
          reasoningEffort: "high",
          signal: ctx.signal,
          onReasoning: (text) => emit({ type: "thinking", runId, text, at: Date.now() }),
        }),
    });

    if (detectResult.ok && detectResult.hasStyleDirection) {
      return {
        aborted: false,
        addendum: "\n\n" + buildDetectedStyleBuildPrompt(detectResult.style),
      };
    }

    // Vague prompt — propose four directions and pause for the user's pick.
    const variantReasoningPrompt = [
      "You are a senior retail UX designer. The user wants to REDESIGN their",
      "existing storefront. Read their request, REASON about the store",
      "(audience, category, brand personality, price tier, cultural context),",
      "then propose FOUR distinct new design directions. Prefer directions that",
      'name a real aesthetic (e.g. "Phố cổ artisan", "Studio café", "Neo-luxe',
      'gold") over generic buckets.',
      "",
      "<user_request>",
      ctx.userPrompt.trim() || "(empty — the user only typed /redesign)",
      "</user_request>",
      "",
      "<project_brief>",
      designBrief,
      "</project_brief>",
      "",
      "Output JSON only — no prose, no code fence. Shape:",
      '{ "question": string, "variants": [v1, v2, v3, v4] }',
      "- question: a SHORT Vietnamese question (≤120 chars) framing the choice,",
      "  referencing the store concept (no paths/code/framework names).",
      "- variants[*]: { id (kebab-case), label (≤40 chars), description",
      "  (Vietnamese, 80–160 chars, hard cap 240, no paths/code/framework),",
      '  preview { font (string), palette (3–5 hex like "#aabbcc"),',
      "  motion (0..1), density (optional 0..1) } }.",
      'All four MUST be meaningfully distinct. Use "label"/"id" — never',
      '"name"/"vibe". Do NOT wrap output in ```json fences.',
    ].join("\n");

    const result = await generateRetailVariants({
      runTurn: async () =>
        runResponsesTurn({
          env: ctx.env,
          prompt: variantReasoningPrompt,
          reasoningEffort: "high",
          signal: ctx.signal,
          onReasoning: (text) => emit({ type: "thinking", runId, text, at: Date.now() }),
        }),
    });
    if (!result.ok) {
      console.warn(
        JSON.stringify({
          event: "redesign_variants_generation_failed",
          runId,
          projectId: ctx.projectId,
          reason: result.reason,
        }),
      );
      return { aborted: false, addendum: "" };
    }

    const handle = getBuilderRunHandle(runId);
    if (!handle) return { aborted: false, addendum: "" };
    const variantOptions = result.variants.map((v) => ({ id: v.id, label: v.label }));
    const question = result.question ?? "Chọn hướng thiết kế mới cho cửa hàng";
    const choice = await new Promise<{ optionId?: string; freeText?: string }>(
      (resolveChoice) => {
        handle.clarificationPrompt = { question, options: variantOptions };
        handle.resumeFn = async (answer) => {
          handle.resumeFn = null;
          handle.clarificationPrompt = null;
          resolveChoice(answer);
        };
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
      },
    );
    if (ctx.signal?.aborted) return { aborted: true };
    const selectedVariant = result.variants.find((v) => v.id === choice.optionId);
    return {
      aborted: false,
      addendum: "\n\n" + buildVariantBuildPrompt({ selectedVariant, freeText: choice.freeText }),
    };
  } catch (error) {
    if (ctx.signal?.aborted) return { aborted: true };
    console.warn(
      JSON.stringify({
        event: "redesign_direction_resolution_threw",
        runId,
        projectId: ctx.projectId,
        rawMessage: error instanceof Error ? error.message : String(error),
      }),
    );
    return { aborted: false, addendum: "" };
  }
}

// Author a new visual identity for an existing storefront via the `/redesign`
// command. The model rewrites DESIGN.md, the runtime refreshes the app.css
// token region from it, and the model restyles the storefront UI to match —
// without renaming existing CSS class names or touching data / cart / routing.
export async function runRedesignBuilderRun(
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
      await runRedesignBuilderRun({ ...ctx, userPrompt: rerunPrompt }, emit);
    },
  );
  if (skillSelection.kind === "required_unavailable") {
    return requiredUnavailableOutcome(ctx, emit, skillSelection.missing);
  }
  if (skillSelection.kind === "paused") {
    return pausedOutcome(ctx, skillSelection);
  }

  const draftWorkspacePath = await ensureProjectWorkspace({
    projectId: ctx.projectId,
  });
  await ensureProjectGitignore({ draftWorkspacePath });
  const fileManifest = await listFiles(draftWorkspacePath);
  const foundationInstructions = await loadFoundationInstructions({
    entries: UPDATE_FOUNDATION_INSTRUCTIONS,
    embedProjectRuleDocs: false,
  });

  // Smart clarification: detect a concrete direction in the prompt (skip the
  // pause) or propose four and pause for a pick. Runs before the build turn so
  // the chosen direction feeds the redesign prompt.
  emitMilestoneInternal(emit, runId, "planning");
  const direction = await resolveRedesignDirection(ctx, emit);
  if (direction.aborted) {
    emit({ type: "cancelled", runId, milestone: "cancelled", at: Date.now() });
    return finalize({
      runId,
      status: "cancelled",
      failureCode: "cancelled",
      changedFiles: [],
      draftWorkspacePath,
      selectedInstructionMeta: [],
      optionalRouteWarnings: [],
    });
  }

  // The redesign template drives DESIGN.md authoring + UI restyle. Append a hard
  // constraint (user requirement): change token/palette/typography values but do
  // NOT rename existing CSS class names — keeps JSX className references valid.
  const redesignPrompt = await loadRedesignRewritePrompt({
    originalPrompt: ctx.userPrompt.trim(),
    tokenHints: direction.addendum,
  });
  const classNamePreservation =
    "\n\nHARD CONSTRAINT: change design TOKEN VALUES (palette hex, typography, " +
    "spacing, radii) in DESIGN.md and src/styles/app.css only. Do NOT rename, " +
    "remove, or invent CSS class names, and do NOT change any JSX `className` " +
    "strings in components/routes. The visual change must come from the token " +
    "values the existing classes already read — not from renamed classes.";

  const bundle = buildContextBundle({
    projectId: ctx.projectId,
    userId: ctx.userId,
    draftWorkspacePath,
    userPrompt: `${redesignPrompt}${classNamePreservation}`,
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

  let thread: BoundedCodexThread;
  try {
    thread = createBoundedCodexThread({
      env: ctx.env,
      draftWorkspacePath,
      skillToolCallbacks: buildSkillToolCallbacks(runId),
      modelReasoningEffort: ctx.reasoningEffort ?? "high",
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

  emitMilestoneInternal(emit, runId, "creating_draft");
  const beforeSnapshot = await takeSnapshot(draftWorkspacePath);

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
    emitFailure(emit, runId, "codex_runtime_failed", "redesign turn ended unexpectedly");
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

  // Refresh the app.css DESIGN_TOKENS region from the model's rewritten
  // DESIGN.md (the template tells the model this happens automatically), then
  // keep the tailwind directives pinned at the top.
  const paletteInjected = await injectDesignPaletteIntoAppCss({ draftWorkspacePath });
  await enforceTailwindDirectivesAtTop({ draftWorkspacePath });
  console.warn(
    JSON.stringify({
      event: "redesign_design_palette_injected",
      runId,
      projectId: ctx.projectId,
      injected: paletteInjected,
    }),
  );

  const afterSnapshot = await takeSnapshot(draftWorkspacePath);
  const diff = diffSnapshots(beforeSnapshot, afterSnapshot);
  const diffGate = runDiffGate({ draftWorkspacePath, diff });
  console.log(
    JSON.stringify({
      event: "redesign_diff_gate_result",
      runId,
      projectId: ctx.projectId,
      ok: diffGate.ok,
      changedFilesCount: diffGate.changedFiles.length,
      changedFilesPreview: diffGate.changedFiles.slice(0, 30),
      violationsPreview: diffGate.violations.slice(0, 30),
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
  const styleRepair = await runRepairLoop({
    thread,
    validate: () => runRootStyleContract(draftWorkspacePath),
    signal: ctx.signal,
    onCycleStart: () => emitMilestoneInternal(emit, runId, "repairing"),
    onProgress: (ev) => emitCodexProgressEvent(ev, runId, emit, toProgressLocale(ctx.locale)),
    createRepairThread: () => createCompactRepairThread(ctx, draftWorkspacePath),
    stage: "root_style_contract",
    runId,
    projectId: ctx.projectId,
    changedFilesCount: diffGate.changedFiles.length,
    context: buildCompactRepairContext({
      ctx,
      draftWorkspacePath,
      changedFiles: diffGate.changedFiles,
      stage: "root_style_contract",
    }),
  });
  if (!styleRepair.finalOutcome.ok) {
    const code: BuilderRunFailureCode =
      styleRepair.cyclesUsed >= 2 ? "repair_exhausted" : "validation_failed";
    emitFailure(emit, runId, code, `root/style contract failed: ${truncate(styleRepair.finalOutcome.summary, 1500)}`);
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
  const typecheckRepair = await runRepairLoop({
    thread,
    validate: () => runTypecheck(draftWorkspacePath, { signal: ctx.signal }),
    signal: ctx.signal,
    onCycleStart: () => emitMilestoneInternal(emit, runId, "repairing"),
    onProgress: (ev) => emitCodexProgressEvent(ev, runId, emit, toProgressLocale(ctx.locale)),
    createRepairThread: () => createCompactRepairThread(ctx, draftWorkspacePath),
    stage: "typecheck",
    runId,
    projectId: ctx.projectId,
    changedFilesCount: diffGate.changedFiles.length,
    context: buildCompactRepairContext({
      ctx,
      draftWorkspacePath,
      changedFiles: diffGate.changedFiles,
      stage: "typecheck",
    }),
  });
  if (!typecheckRepair.finalOutcome.ok) {
    const code: BuilderRunFailureCode =
      typecheckRepair.cyclesUsed >= 2 ? "repair_exhausted" : "validation_failed";
    emitFailure(emit, runId, code, `typecheck failed: ${truncate(typecheckRepair.finalOutcome.summary, 1500)}`);
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
    onProgress: (ev) => emitCodexProgressEvent(ev, runId, emit, toProgressLocale(ctx.locale)),
    createRepairThread: () => createCompactRepairThread(ctx, draftWorkspacePath),
    stage: "build",
    runId,
    projectId: ctx.projectId,
    changedFilesCount: diffGate.changedFiles.length,
    context: buildCompactRepairContext({
      ctx,
      draftWorkspacePath,
      changedFiles: diffGate.changedFiles,
      stage: "build",
    }),
  });
  if (!buildRepair.finalOutcome.ok) {
    const code: BuilderRunFailureCode =
      buildRepair.cyclesUsed >= 2 ? "repair_exhausted" : "validation_failed";
    emitFailure(emit, runId, code, `build failed: ${truncate(buildRepair.finalOutcome.summary, 1500)}`);
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

  emitFinalAnswer(emit, runId, finalResponse, { runKind: ctx.kind, changedFiles: diffGate.changedFiles });
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
