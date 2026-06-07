# Contract — Builder-run drivers (Codex SDK adapter)

**Date**: 2026-06-07 · **Plan**: [../plan.md](../plan.md)

This contract defines the inputs, outputs, and side-effects of the codex builder-run drivers as consumed by both Phase 1 (`MessageService.runOrchestrator`) and Phase 2+ (`/api/projects/$projectId/builder-runs` POST). It pins down sandbox modes, reasoning effort wiring, and event subscription so callers are interchangeable.

---

## Driver entry points

```ts
type BuilderRunDriver = (
  ctx: BuilderRunContext,
  emit: (event: BuilderRunEvent) => void,
) => Promise<BuilderRunOutcome>;

const drivers: Record<BuilderRunKind, BuilderRunDriver> = {
  init: runInitBuilderRun,
  update: runSmallUpdateBuilderRun,
  new_route: runNewRouteBuilderRun,
};
```

`BuilderRunKind` is resolved by R5 (project state + classifier). Callers pass it explicitly; drivers do not classify.

---

## BuilderRunContext (input)

```ts
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

  // ADDITIONS (Phase 0):
  reasoningEffort: ComposerReasoningEffort | null;     // R1
  planMode: boolean;                                   // R2/R3 (only meaningful for `update` and `new_route` kinds)
};
```

### Validation

- `kind` in `["init", "update", "new_route"]`.
- `userPrompt` non-empty after trim.
- `signal` may be omitted; drivers default to a no-op `AbortController`.
- `planMode` is silently ignored when `kind === "init"` (init has its own variant flow).

---

## BuilderRunOutcome (output)

```ts
export type BuilderRunOutcome = {
  runId: string;
  status: BuilderRunStatus;          // "done" | "failed" | "cancelled" | "awaiting_clarification"
  failureCode?: BuilderRunFailureCode;
  changedFiles: string[];            // raw file paths — INTERNAL only, never surfaced to UI
  draftWorkspacePath: string;
  selectedInstructionMeta: ReturnType<typeof buildContextBundle>["selectedInstructionMeta"];
  optionalRouteWarnings: string[];
};
```

`changedFiles` is the raw list produced by codex; consumers MUST run it through `fileChangeToSection` (R6) before any UI usage.

---

## Codex thread configuration (per driver)

| Driver / phase | `sandboxMode` | `modelReasoningEffort` | Notes |
|---|---|---|---|
| `update` / `new_route` execute turn | `workspace-write` | from `ctx.reasoningEffort` (default `medium`) | existing path |
| `update` / `new_route` plan turn (when `planMode = true`) | `read-only` | `xhigh` (forced) | R2/R3 — separate thread |
| `init` build turns | `workspace-write` | `high` (forced) | already set by existing init driver |
| `init` design-variant turn (Phase 4) | `read-only` | `high` | structured JSON output for variants |

Both threads obey:

- `networkAccessEnabled: false`
- `approvalPolicy: "never"`
- `additionalDirectories: []`
- `skipGitRepoCheck: true`
- `workingDirectory: <draftWorkspacePath>`

---

## Event emissions

The driver invokes `emit` with `BuilderRunEvent` values. Callers MUST handle:

- `milestone` — existing milestone events (`loading_context` → `publishing`).
- `awaiting_clarification` — extended with `metadata: { questionType, options, customAnswerAllowed }`.
- `done` / `failed` / `cancelled` — terminal.

Drivers MUST NOT emit user-visible text directly. The translator (Phase 1) and the SSE handler (Phase 2) are responsible for surfacing user-visible strings via `phaseLabel` / `fileChangeToSection` / `extractSummary`.

### Plan-mode driver semantics (Phase 3)

When `planMode = true` and `kind !== "init"`:

1. Emit `milestone: "planning"`.
2. Start a fresh thread with `sandboxMode: "read-only"`, `modelReasoningEffort: "xhigh"`.
3. Run a single turn with the prompt template from R3.
4. Capture `Turn.finalResponse` as `planMarkdown`. If the turn produced any `file_change` items, treat the run as a privacy violation: mark the run failed with `failureCode: "blocked_request"` (the prompt + sandbox should make this impossible; the check is defence-in-depth).
5. Emit `awaiting_clarification` with `metadata = { questionType: "plan_review", planMarkdown }`. Persist `planPhase = { stage: "plan_ready", planMarkdown, planTurnDoneAt, planThreadId }`.
6. Pause until the resume callback fires with `planAction = "approve" | "reject"`.
7. On `approve`: persist `planPhase.stage = "executing"`. Start a NEW thread with `sandboxMode: "workspace-write"`, `modelReasoningEffort: ctx.reasoningEffort ?? "medium"`. First turn prompt: `Original task: <ctx.userPrompt>\n\nApproved plan:\n<planMarkdown>\n\nExecute the plan now.`. Continue with the existing execute-turn flow (snapshots, repair loop, validation, promotion gate).
8. On `reject`: persist `planPhase.stage = "plan_rejected"`, emit `failed` with `failureCode: "cancelled"`, end the run cleanly.

### Design-variant driver semantics (Phase 4)

For `kind === "init"`:

1. After loading context, run a single read-only thread to produce four retail-vibe variants as structured JSON (`outputSchema` in `TurnOptions`).
2. Validate JSON; on failure, retry once.
3. Emit `awaiting_clarification` with `metadata = { questionType: "design_variant", options: DesignVariant[4], customAnswerAllowed: true }`.
4. On answer (`optionId` or `freeText`), persist the choice and continue with the existing init build flow, embedding the variant or custom guidance into the build prompt.

---

## Error mapping

| Internal cause | `failureCode` | UI message family |
|---|---|---|
| codex SDK `Error.message` mentions `network` | `codex_runtime_failed` | "Network issue, retry?" |
| `Codex env not available` | `config_unavailable` | "AI builder is unavailable" |
| classifier returned `unsupported` | `blocked_request` | "Yêu cầu nằm ngoài phạm vi" |
| diff gate found out-of-workspace writes | `boundary_violation` | "Yêu cầu bị chặn vì lý do an toàn" |
| typecheck/build failed twice | `repair_exhausted` | "Vẫn còn lỗi sau khi tự sửa" |
| preview health failed | `preview_failed` | "Preview chưa lên được" |
| run had no live handle on boot scan | `interrupted_by_restart` | "Phiên xử lý bị gián đoạn, thử lại?" |
| plan turn produced file-change item | `blocked_request` | "Plan mode đã ghi vào file (lỗi an toàn)" |

The translator/SSE layer maps these to friendly Vietnamese-first user copy.

---

## Idempotency, concurrency, signal handling

- One driver per `(projectId)` at a time, enforced by `createBuilderRunHandle` throwing `ActiveRunExistsError`.
- `signal` propagates to `thread.run({ signal })` and to filesystem snapshot operations; abort cleans up the draft workspace.
- The driver's promise resolves to `BuilderRunOutcome`; on uncaught error, callers are responsible for emitting a `failed` event (existing behavior in `/builder-runs/index.ts`).

---

## Testability hooks

- A test double replaces `BoundedCodexThread` with a scripted event yielder. The driver under test consumes scripted events to verify state transitions without invoking codex.
- The plan-mode driver exposes `runPlanTurn` and `runExecuteTurn` as separately testable functions; integration tests assert that `runPlanTurn` ends without any workspace mutation (SC-006).
- The init driver exposes the variant validation function so a fixture-based unit test asserts the JSON schema.
