# Quickstart — Codex SDK Chat Migration

**Date**: 2026-06-07 · **Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md)

This quickstart shows a developer how to set up, run, and verify the migration phase by phase. Each phase has a "stop and demo" checkpoint. If a checkpoint fails, **fix before moving on**.

---

## Prerequisites

- Node.js 22+ with `pnpm` 9+
- PostgreSQL running locally (`pnpm dev:db` or whatever the repo uses)
- A test retailer user signed in
- A scratch project under `var/bin/projects/<projectId>/` with `pm2` not yet started

### Codex SDK environment variables

The migration depends on the Codex SDK runtime envs. Set them in `.env.local` (names only — never check secrets in):

| Variable | Purpose |
|---|---|
| `CODEX_API_KEY` | Auth token for the codex provider. |
| `CODEX_BASE_URL` | API base URL (defaults to upstream when unset). |
| `CODEX_HOME` | Filesystem root the SDK uses for thread state. |
| `CODEX_MODEL` | Model id passed to `codex.startThread`. |

The codex env helper is at `src/server/env/codex.ts`; it reads these names exactly. Missing values surface as `config_unavailable` failures via `BuilderRunFailureCode` (per `contracts/builder-runs.md`).

```bash
pnpm install
pnpm typecheck
pnpm vitest run
```

All three MUST pass before any code change in this feature.

---

## Phase 0 — Foundation (no user-visible change)

### Implement

1. Add the three additive `json()` columns on `agent_runs`:
   - `progress_timeline` (default `[]`)
   - `plan_phase` (default `null`)
   - `clarification_snapshot` (default `null`)
   - Plus `kind` enum and `interrupted` status / `interrupted_by_restart` failure code.
   Run `pnpm db:generate` and `pnpm db:migrate`.
2. Extend `agent-run-repository.ts` with read/write helpers for the new columns + a `boot scan` function that reconciles in-memory handles vs. DB rows.
3. Wire `modelReasoningEffort` through `BuilderRunContext` and `createBoundedCodexThread`.
4. Create `src/server/functions/progress-mapper.server.ts` with `phaseLabel`, `fileChangeToSection`, `extractSummary`, and `isPrivacySafe`. Cover with a Vitest unit suite (γ table, α labels, privacy adversarial corpus).

### Verify

- `pnpm typecheck` passes.
- `pnpm vitest run progress-mapper agent-run-repository` — all green.
- Manual smoke: insert a synthetic `agent_runs` row with `status=streaming` and no in-memory handle; restart the server. The boot scan flips it to `failed` with `failureCode=interrupted_by_restart`.

### Stop-and-demo

No UI demo. Only repository + unit tests. **Do not move on if Vitest is red.**

---

## Phase 1 — Bridge inside MessageService (KILLS THE BUG)

### Implement

1. In `src/server/services/message-service.ts`, replace the body of `runOrchestrator` so that:
   - Resolve `kind` per R5 (project state + classifier).
   - Build `BuilderRunContext` (with the run's `reasoningEffort` + `planMode`).
   - Pick the right driver (`runInitBuilderRun` / `runSmallUpdateBuilderRun` / `runNewRouteBuilderRun`) and start it.
   - Subscribe to its `BuilderRunHandle` events; translate each event using the rules in `contracts/progress-events.md`.
   - Persist β-lite answer as a `Message{ kind: "answer" }`.
2. Keep all existing `RunStreamEvent` types unchanged (clients are blind to the swap).
3. Add a contract test (`tests/contract/builder-bridge.contract.test.ts`) using a fake `BoundedCodexThread` that yields scripted events; assert SSE output matches the legacy shape.

### Verify

```bash
pnpm typecheck
pnpm vitest run
pnpm dev   # start the app
```

Manual smoke (the original bug repro):

1. Open a healthy initialized project.
2. In the chat composer, type **"thêm image vào hero"** with reasoning effort `medium`, plan mode off.
3. Submit.
4. Observe:
   - The chat shows progress messages framed at section level only.
   - No file paths or framework tokens appear in any chat or progress text.
   - The preview reloads without a Vite parse error and the new hero image is visible.
5. Reload the page. The user prompt + β-lite answer are still in chat history.

If preview still parses, **the original bug is killed (US1, SC-001)**.

### Stop-and-demo checkpoint (Phase 1 ✅)

- US1 acceptance scenarios pass.
- US2 acceptance scenarios pass (privacy holds).
- Frontend code unchanged.

---

## Phase 2 — Migrate frontend chat to `/builder-runs`

### Implement

1. Build `useChatStream` (a hook unifying composer state, messages, and SSE) that POSTs to `/api/projects/$projectId/builder-runs` and subscribes to `/api/projects/$projectId/builder-runs/$runId/stream`.
2. Update `src/routes/projects/$projectId.tsx` to use `useChatStream` instead of `useAgentStream`.
3. Add a chat-history endpoint (`GET /api/projects/$projectId/messages`) backed by `messageRepository.listMessages`.
4. Extend the existing `/builder-runs/index.ts` POST to also persist user `Message` + `agent_runs` row (replicating `MessageService.createRun`).
5. Wire the composer reasoning-effort dropdown into the POST body.
6. Wire the Stop, Retry buttons to the existing `/builder-runs/$runId/cancel` and `/builder-runs/$runId/retry` endpoints.

### Verify

- `pnpm typecheck` passes.
- All Vitest tests pass.
- Manual smoke: repeat the US1 prompt against the new path. Observe identical UX. Reload — chat history persists.
- Manual smoke (US6 lite): `pkill -f node` mid-run, restart server, reload chat. The run shows interrupted state with retry available; retry succeeds.

### Stop-and-demo checkpoint (Phase 2 ✅)

- US1 + US2 still pass on the new path.
- Chat panel uses no `useAgentStream` import.

---

## Phase 3 — Plan mode (two-phase)

### Implement

1. Introduce `src/features/agents/codex/runtime/plan-mode.server.ts` that wraps `runSmallUpdateBuilderRun` / `runNewRouteBuilderRun` with the plan turn → approve/reject → execute turn flow per R2/R3.
2. Add `metadata: { questionType: "plan_review", planMarkdown }` to the awaiting-clarification event.
3. Add `PlanReview.tsx` UI: render plan markdown, show Approve / Reject buttons, post to `/builder-runs/$runId/answer` with `{ planAction }`.
4. Persist plan markdown as `Message{ kind: "plan", metadata: { planPhase: "plan_ready" | "plan_rejected" } }`.

### Verify

- Unit tests: plan turn produces zero workspace mutations (snapshot diff).
- Manual smoke US3:
  1. Toggle plan mode on; submit prompt.
  2. Plan markdown appears with the seven required sections.
  3. `git diff` (or workspace snapshot) shows no changes.
  4. Click Approve → execute turn runs and preview reflects the change.
  5. Reset workspace, repeat with Reject → run ends, no changes.

### Stop-and-demo checkpoint (Phase 3 ✅)

- US3 acceptance scenarios pass.
- SC-006 verified on at least 5 plan runs.

---

## Phase 4 — Design variants (retail vibe) + clarification UI by `questionType`

### Implement

1. Build `src/features/agents/codex/runtime/design-variants.server.ts` per R7. Use `outputSchema` on the codex turn for strict JSON.
2. Wire `runInitBuilderRun` to call the variant generator before the build phase, then emit `awaiting_clarification` with `metadata: { questionType: "design_variant", options }`.
3. Add `DesignVariantPicker.tsx` (palette dots + 1-line description) and `SkillClarificationList.tsx` (id+label list). Switch by `metadata.questionType`.
4. On selection, post to `/builder-runs/$runId/answer` with `{ optionId }` or `{ freeText }`. Persist on `agent_runs.clarificationSnapshot.selectedOptionId`.

### Verify

- Unit tests: variant JSON schema, four-variant invariant, palette length validation, retail-vibe prompt template.
- Manual smoke US4:
  1. Create a brand-new project.
  2. Submit init prompt.
  3. Four retail-vibe cards appear with palette dots + description.
  4. Pick one → build completes; preview reflects the chosen palette/typography.
  5. Repeat init with custom freeText; agent uses the text as guidance.
- Manual smoke US5:
  1. Trigger a skill clarification.
  2. UI renders a simple list (not cards).
  3. Select an option → run continues.

### Stop-and-demo checkpoint (Phase 4 ✅)

- US4 + US5 pass.

---

## Phase 5 — Big-bang cleanup

### Implement

1. Tag a snapshot: `git tag legacy-aiagent-snapshot HEAD~0`.
2. Run a code-graph review of `@/features/ai-agent/**` callers; confirm none remain.
3. Delete in one PR:
   - `src/features/ai-agent/**`
   - `src/routes/api/projects/$projectId/runs/**`
   - `src/server/services/message-service.ts` (and any imports / service-registry references).
   - Any legacy run-store or stream helpers that exclusively served the legacy path.
4. Update `src/routes/projects/$projectId.tsx` if any leftover legacy import remains.
5. Run `pnpm typecheck`, `pnpm vitest run`, and the full chat smoke.

### Verify

- `pnpm exec rg -l '@/features/ai-agent'` returns zero matches.
- `pnpm exec rg '/api/projects/\$projectId/runs'` returns zero matches outside historical specs.
- Chat works end-to-end on the single remaining path.
- SC-005 satisfied.

### Stop-and-demo checkpoint (Phase 5 ✅)

- One agent path. Bug class extinct. Codebase ~100 KB lighter.

---

## Common pitfalls

- **Forgetting `json()` over `jsonb()`** on the new columns. Constitution IX rejects the PR.
- **Reusing the plan thread for the execute turn** (sandbox stays read-only; writes silently no-op). Use two threads (R2).
- **Letting the β-lite summary skip the privacy filter** when codex emits an unusually long `finalResponse`. Always filter; fall back to phase-default if rejected.
- **Persisting the entire `Turn.finalResponse`** raw in `Message.content`. Only the filtered β-lite summary is persisted.
- **Letting init kind leak from client**. R5 mandates server-side resolution; reject `body.kind` in `/builder-runs` POST in Phase 2.
- **Deleting legacy code in Phase 1–4**. Leave it untouched until Phase 5 to preserve rollback ability.

---

## Rollback plan

- Each phase ships behind no feature flag (small phases, fast iteration). The rollback unit is the merged commit. `git revert <commit>` restores the previous behavior because:
  - Phase 0 only adds columns + helpers; reverting drops them safely (data is JSON, default null).
  - Phase 1 swaps the body of `runOrchestrator`; revert restores the legacy body.
  - Phase 2 changes routes + UI; revert restores the prior wiring.
  - Phase 3, 4 add new modules; revert removes them.
  - Phase 5 deletes legacy code; if a regression appears, reset to `legacy-aiagent-snapshot`.

If the bug returns post-Phase 1, the most likely root cause is a residual code path still calling `ProjectPatchService.applyHunks`. Search and reroute.
