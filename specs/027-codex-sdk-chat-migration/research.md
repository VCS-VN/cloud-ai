# Phase 0 Research — Codex SDK Chat Migration

**Date**: 2026-06-07
**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

This document resolves all open verification points and dependency questions surfaced by the spec, plan, and the upstream `/grill-me` decisions. Each entry follows the format **Decision / Rationale / Alternatives**.

---

## R1. Codex SDK reasoning effort wiring

**Decision**: Pass the user-selected effort through `BuilderRunContext` → `createBoundedCodexThread` → `codex.startThread({ modelReasoningEffort })`. Map the existing composer values 1:1 to `ModelReasoningEffort`: `low → "low"`, `medium → "medium"`, `high → "high"`, `xhigh → "xhigh"`. Do not expose `"minimal"` to users in this iteration.

**Rationale**: `node_modules/@openai/codex-sdk/dist/index.d.ts:237` confirms `type ModelReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh"` is a `ThreadOptions` field (line 244). 1:1 mapping avoids translation bugs. `xhigh` already exists in our composer, so no UI change is required for FR-010.

**Alternatives considered**:
- Inline-set `modelReasoningEffort` on every `thread.run()` call. Rejected: SDK accepts it only on `ThreadOptions`, not `TurnOptions`.
- Introduce `"minimal"` as a fifth tier. Rejected: `spec.md` (FR-010) requires four levels and adding a level changes the composer scope without user value today.

---

## R2. Plan mode sandbox semantics across turns

**Decision**: Run the plan turn and the execute turn as **two separate threads**. The plan thread is created with `sandboxMode: "read-only"`; the execute thread is created with `sandboxMode: "workspace-write"`. The execute thread receives the plan markdown as part of its first prompt so the agent has the same understanding without re-planning.

**Rationale**: `ThreadOptions.sandboxMode` is set at `startThread`-time only (line 241-244). `TurnOptions` (line 167-172) only carries `outputSchema` and `signal`, with no sandbox override. Therefore the plan turn cannot upgrade its own sandbox; reusing the same thread for execute would inherit the read-only sandbox and silently fail every write. Two-thread design is the only correct mechanic.

**Alternatives considered**:
- Reuse the same thread with two sequential `thread.run()` calls. Rejected: read-only sandbox would block every file write in execute turn.
- Skip the plan thread and bake plan instructions into the execute thread prompt. Rejected: violates FR-013 (plan turn must produce a structured plan and pause for explicit Approve before any mutation).

---

## R3. Plan mode prompt template

**Decision**: Use the user-provided template verbatim. Render it as a single string with the user's task interpolated into `{task}`:

```
You are in PLAN MODE.

Hard rules:
- Do NOT modify files.
- Do NOT create files.
- Do NOT delete files.
- Do NOT run commands that write to disk.
- You may inspect/read files only.
- Your output must be a plan, not an implementation.
- Do not include full code patches unless explicitly asked.

Task:
{task}

Return exactly this structure:

## Understanding
## Findings
## Proposed Plan
## Files To Change
## Risks / Edge Cases
## Validation Plan
## Questions
```

The two MUST-include lines (`Your output must be a plan, not an implementation.` and `Do not include full code patches unless explicitly asked.`) are present.

**Rationale**: Constraint comes directly from the user. Sandbox is `read-only` so the prompt is the secondary defence (defence-in-depth) for FR-013 / SC-006.

**Alternatives considered**:
- Auto-paraphrase the rules at request-time. Rejected: drift across runs makes test fixtures brittle.
- Embed plan instructions only in a system message. Rejected: codex SDK `Thread` does not expose a system prompt API; instructions must ride the user prompt.

---

## R4. Restart-safe persistence for `BuilderRunHandle`

**Decision**: Extend `agent_runs` (existing Drizzle table referenced by `agent-run-repository.ts`) with three additive `json()` columns:
- `progress_timeline` — append-only array of `{ at, kind, payload }` events (capped at the last N events; older items dropped to keep row size bounded).
- `plan_phase` — `null | { stage: "plan_pending" | "plan_ready" | "executing", planMarkdown?, planTurnDoneAt? }`.
- `clarification_snapshot` — `null | { questionType, options, originalRunPrompt }` so awaiting-clarification can be rebuilt after restart.

`BuilderRunHandle` becomes a thin in-memory wrapper that mirrors writes to `agent_runs`. On boot, a startup hook scans `agent_runs` for non-terminal rows whose handle is missing and either: (a) marks them `failed` with `failureCode: "interrupted_by_restart"` if the run was executing, or (b) reconstructs an awaiting-clarification handle so the SSE replay still works.

**Rationale**: Codex thread state cannot be persisted (no SDK accessor). We can persist UI-recovery state (status, last phase, clarification details) — that satisfies FR-023, FR-024, FR-025 without faking thread continuation. Constitution IX requires `json()` over `jsonb()` for these columns.

**Alternatives considered**:
- Persist every event into a separate `agent_run_events` table. Rejected: doubles write volume and join cost without UX benefit; the timeline is purely transient (D').
- Persist nothing, accept restart-during-clarification loss. Rejected: violates FR-023 acceptance scenario 2.

---

## R5. Init-kind detection (Q6b confirmed)

**Decision**: In the entry path used by chat (Phase 1 inside `MessageService.runOrchestrator`, Phase 2+ inside the `/builder-runs` POST handler):
1. If `project.status === "draft"` OR `listFiles(workspaceRoot)` is empty → `kind = "init"`.
2. Otherwise call existing `classifyUpdatePrompt({ prompt, fileManifest })` and use its result; if it returns `"unsupported"`, return a friendly `blocked_request` error to the user.

The frontend stops sending `kind`. Server is the source of truth.

**Rationale**: Empty workspace is an unambiguous signal for init. Re-using `classifyUpdatePrompt` avoids reintroducing legacy classifier logic. FR-002 requires deterministic classification.

**Alternatives considered**:
- Trust client-supplied `kind`. Rejected: multi-tab and stale UI state can produce wrong values.
- Always classify (no project-state shortcut). Rejected: classifier uses prompt text, not project state, and would mis-fire on init prompts that read like updates.

---

## R6. Progress strategy (γ + α + β-lite)

**Decision**: A new module `src/server/functions/progress-mapper.server.ts` exports:
- `fileChangeToSection(filePath: string, locale: "vi" | "en"): string | null` — γ mapping.
- `phaseLabel(phase: BuilderRunMilestone, locale): string` — α hardcoded labels for non-file phases (`loading_context`, `planning`, `creating_draft`, `building_pages`, `checking_preview`, `repairing`, `publishing`).
- `extractSummary(turnFinalResponse: string, locale): string` — β-lite summarizer that strips path/code-like tokens and returns a single line; falls back to a phase-default sentence if extraction fails.

The γ table maps TanStack Router file-based routes to user-visible sections:
- `src/routes/index.tsx` → "trang chủ"
- `src/routes/products/index.tsx` → "trang danh sách sản phẩm"
- `src/routes/products/$productId.tsx` → "trang chi tiết sản phẩm"
- `src/routes/cart.tsx` → "trang giỏ hàng"
- `src/routes/checkout.tsx` → "trang thanh toán"
- `src/routes/__root.tsx` → "khung chung của site"
- `src/components/storefront/Hero.tsx` → "phần hero"
- `src/components/storefront/ProductCard.tsx` → "khối sản phẩm"
- `src/components/storefront/Header.tsx` → "phần đầu trang"
- `src/components/storefront/Footer.tsx` → "phần chân trang"
- (fallback) `src/components/...` → "một phần của giao diện"
- (fallback) `src/styles/app.css` / `DESIGN.md` → "hệ thống thiết kế"
- (fallback) any other path → suppress (no message emitted).

A privacy filter regex strips file paths (`/[\w-]+\.(tsx?|css|json|md)/g`), camelCase/PascalCase identifiers ≥ 3 chars adjacent to backticks, code fences, and known framework tokens (`tsx`, `vite`, `tanstack`, etc.). β-lite output runs through the filter before being persisted as `kind: "answer"`.

**Rationale**: γ + α gives deterministic, leak-free progress for FR-006, FR-007, FR-009. β-lite supplies the chat-conversation feel from the user prompt without exposing internals (FR-008). Fallback "suppress" honours the privacy guarantee.

**Alternatives considered**:
- Single all-LLM narrator (β full). Rejected during grill-me — leak risk too high.
- Hard table with no fallback. Rejected: codex changes might emit unmapped paths; suppress is safer than misleading text.

---

## R7. Design-variant prompt + clarification metadata (b2 + d-A)

**Decision**: Add a new server module `design-variants.server.ts` that:
1. Issues a Codex turn with `modelReasoningEffort: "high"`, sandbox `read-only`, and a curated retail-vibe prompt (anchored to skills `design-taste-frontend` + a new `retail-vibe-presets` skill) instructing the agent to emit a JSON list of exactly four variants matching `DesignVariant` schema.
2. Validates the JSON against a strict schema; on validation failure, retries once.
3. Surfaces a builder-run `awaiting_clarification` event with `questionType: "design_variant"` and `metadata` containing the four variants.

The clarification UI dispatches by `questionType`:
- `"design_variant"` → `DesignVariantPicker.tsx` (visual lite — palette dots + 1-line description).
- `"skill_clarification"` → `SkillClarificationList.tsx` (id+label list).

Builder events get an additive `metadata?: { questionType, options, ... }` field (FR-022, US5).

**Rationale**: Two-component split satisfies the spec (FR-019, FR-022). Strict JSON schema avoids LLM free-form leaks (privacy). Curated skill anchor keeps "retail vibe" consistent across runs.

**Alternatives considered**:
- One unified card UI for both clarifications. Rejected: skill clarifications don't have palette/description — empty fields look broken.
- Free-form LLM markdown for variants. Rejected: hard to validate; prone to leaking implementation hints.

---

## R8. Phase 1 event translation (BuilderRunEvent → RunStreamEvent)

**Decision**: Inside `MessageService.runOrchestrator`, replace the `agentOrchestrator.handlePromptStream` consumer with a translator that listens to `BuilderRunHandle.subscribers` and emits the existing `RunStreamEvent` shape:
- `BuilderRunMilestone(milestone) → SkeletonUpdateEvent({ phase, label, detail })` using `phaseLabel`.
- `file_change` items (collected from each `Turn.items`) → `SkeletonUpdateEvent({ phase: "editing", label: "Đang cập nhật ${section}" })` using `fileChangeToSection`.
- `turn.completed.finalResponse` → `MessageCreatedEvent({ kind: "answer" })` then `MessageDeltaEvent` chunks then `MessageCompletedEvent`. The whole text is filtered through the privacy filter before persisting.
- `awaiting_clarification` → translate to `kind: "agent_question"` message + `run.awaiting_input` event, with metadata routed by `questionType`.
- `done` → `RunTerminalEvent("run.completed")`.
- `failed` → `RunTerminalEvent("run.failed")` with friendly error content.
- `cancelled` → `RunTerminalEvent("run.stopped")`.

**Rationale**: Phase 1 must keep the frontend untouched (FR-026). Translation in `MessageService` is local, reversible, and isolated. The bug disappears immediately because `ProjectPatchService.applyHunks` is no longer in the call path.

**Alternatives considered**:
- Big-bang rewrite frontend at the same time. Rejected: violates FR-026 phase boundary contract; bigger blast radius.
- Translate at the SSE layer. Rejected: SSE layer is per-run-id with two registries; cleaner to translate inside service before publish.

---

## R9. Stop / Retry / Resume continuity

**Decision**:
- Stop: `MessageService` aborts the active run via `BuilderRunHandle.abortController.abort()` and emits `run.stopped`. Phase 2 wires the composer Stop button to `/api/projects/$projectId/builder-runs/$runId/cancel`.
- Retry: existing `/api/projects/$projectId/builder-runs/$runId/retry` is reused; Phase 2 wires the chat retry button to it. Reasoning effort is reused from the prior run unless the user changes it before retry (FR-011 / SC-009).
- Resume: on page mount, the chat reads `project.activeRunId` (already persisted) and reconnects via `/builder-runs/$runId/stream`. If the SSE returns 404 or terminal-failed, the run is considered interrupted (R4).

**Rationale**: Reuses existing endpoints. Keeps FR-004 / FR-005 / FR-023 simple.

**Alternatives considered**:
- Build a separate "resume" endpoint. Rejected: stream endpoint already replays buffered events from the handle and now the persisted timeline.

---

## R10. Cleanup (Phase 5) detection — what code is safe to delete

**Decision**: After Phase 4 ships, run `pnpm exec rg -l '@/features/ai-agent'` to enumerate any caller. The expected zero-result set after Phase 5 prep includes:
- `src/features/ai-agent/**` (entire directory)
- `src/routes/api/projects/$projectId/runs/**` (entire route subtree)
- `src/server/services/message-service.ts` (replaced by the builder-runs path)
- `src/features/projects/legacy/project-run-store.server.ts` (replaced by `agent-run-repository`)
- `src/features/runtime/legacy/**` if not reused elsewhere — verify per-file before delete
- `@/server/functions/project-message-stream.ts` if exclusively used by the legacy path — verify
- `@/server/functions/project-runs.ts` if exclusively used by the legacy `createRun` server function — verify

Cleanup PR runs typecheck + lint + a chat smoke test (US1) before merge.

**Rationale**: SC-005 demands a single agent path post-Phase 5. Per-file verification avoids accidentally deleting still-shared utilities (e.g., runtime stream may be reused for `dev_*` events).

**Alternatives considered**:
- Rolling cleanup per phase (Q6c option A, rejected during grill). Rejected by user — big-bang preferred for a clean diff.

---

## R11. Test strategy summary

**Decision**: Each phase ships with these test layers before moving on:
- **Unit (Vitest)**: `progress-mapper` (γ table coverage, privacy filter), `update-classifier` extension for `kind=init`, `agent-run-repository` round-trip on new `json()` columns, plan-mode prompt template renderer, design-variant JSON validator.
- **Contract**: SSE event shape for Phase 1 translator (`tests/contract/builder-bridge.contract.test.ts`); `/builder-runs` POST/GET/answer/cancel/retry contract for Phase 2.
- **Integration**: One end-to-end scenario per user story (US1..US6) using a stubbed `BoundedCodexThread`. The stub yields scripted `ThreadEvent`s.
- **Manual smoke**: After Phase 1 — a real chat update in the dev project (the same prompt that produced the original bug). After Phase 3 — plan→approve and plan→reject. After Phase 4 — init flow with variant pick + custom answer. After Phase 5 — typecheck + chat smoke.

**Rationale**: Mirrors Constitution II while keeping the spec testable per user story (independent test column).

**Alternatives considered**:
- E2E browser tests via Playwright. Out of scope for this migration; project does not yet have an E2E harness.

---

## Open items (none blocking)

- **Retail-vibe prompt iteration**: requires LLM trial and few-shot tuning during Phase 4. Tracked as an implementation task, not a research gap.
- **Cleanup safety net**: keep a tag `legacy-aiagent-snapshot` immediately before the Phase 5 delete commit to enable revert if a hidden caller is missed.
