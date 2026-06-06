# Task Breakdown Prompt — Codex SDK Migration

Use this prompt to generate `specs/025-codex-sdk-migration/tasks.md`. It is self-contained: feed it together with the four source files listed below.

---

## Prompt to send

You are generating an executable task list for the Codex SDK migration of the cloud-ai project. Read the four source documents below in full before producing any output, then emit a single `tasks.md` that matches `.specify/templates/tasks-template.md`.

### Source documents (read all four, in order)

1. `docs/codex-sdk-migration-grill-summary.md` — final grill decisions for the Codex SDK builder.
2. `skill-runtime-discussion-summary.md` — final grill decisions for the deferred generic skill runtime (forward-compat constraints only; do NOT implement skill runtime here).
3. `specs/025-codex-sdk-migration/spec.md` — 8 user stories (US1–US8) and 48 functional requirements (FR-001 through FR-048).
4. `specs/025-codex-sdk-migration/plan.md` — Constitution Check, module layout, 9-phase roadmap (Phase 0 → Phase 8), risks, out-of-scope.

### Hard constraints

- **Output only `specs/025-codex-sdk-migration/tasks.md`.** No prose around it, no other files.
- **Follow the tasks-template structure exactly**: `## Phase 1: Setup`, `## Phase 2: Foundational`, then `## Phase 3+: User Story N` blocks, ending with `## Phase N: Polish & Cross-Cutting`. Use the `[ID] [P?] [Story] Description` format.
- **Replace ALL placeholder content from the template.** No leftover `T001 Create project structure per implementation plan`, no `[Entity1]`, no example file paths.
- **Numbering**: `T001`, `T002`, … sequential across the whole file. Do not restart per phase.
- **Story labels**: `[US1]`–`[US8]` map 1:1 to the user stories in `spec.md`. Foundational and Setup tasks have no `[USx]` label. Polish tasks may use `[ALL]` or omit the story tag.
- **`[P]` parallel marker**: Apply only when the task touches a file no other parallel-marked task in the same phase touches AND has no dependency on another task in the same phase. Be conservative — when in doubt, drop `[P]`.
- **File paths must be exact**, taken from `plan.md` Project Structure (e.g. `src/features/agents/codex/runtime/codex-thread.server.ts`, `templates/codex-builder/foundation/retail-constraints.md`, `tests/unit/agents/codex/boundary/path-guard.test.ts`).
- **Tests are REQUIRED** (Constitution Principle II demands tests for core business rules — boundary enforcement, validation gates, parser, retention scheduler, milestone mapping). Include a `### Tests for User Story N` block before each story's implementation block. Tests for FR-016 (boundary), FR-025 (validation), FR-027 (repair), FR-031–FR-033 (product sample parser), FR-029 (preview health) are mandatory. Other tests are optional.
- **Phase 0 of `plan.md` is already done** (this PR landed spec/plan/grill sync). Start the task list at Phase 1 (Templates migration) of `plan.md`, mapped to `## Phase 1: Setup` of the template.
- **Skill runtime tasks are out of scope.** Forward-compat extension points (FR-043 → FR-047) are in scope: `<selected_instruction>` wrapper, `selectedInstructions[] / pendingInstructions[]` schema fields, `SKILLS_ROOT` env reservation. Do NOT add tasks for skill detector, skill scoring, `project_read_skill`, or skill clarification.

### Phase mapping (template phase → plan phase)

| tasks.md phase | plan.md phase | Scope |
| --- | --- | --- |
| Phase 1: Setup | plan Phase 1 (Templates migration) + plan Phase 2 (env + Codex config + module skeleton) | `git mv` retail templates into `templates/codex-builder/*`; add `@openai/codex-sdk`; new env vars; `codex-config.server.ts`; module folder skeleton; feature-flag wiring. |
| Phase 2: Foundational | plan Phase 3 (DB schema + neutral infra move) + plan Phase 4 shared parts (context builder, milestone mapper, instruction loader) + plan Phase 5 shared parts (boundary, validation, retention base modules) | Drop `agent_runs`; create `builder_runs` table with FR-036 columns; move neutral infra out of `src/features/ai-agent/*`; protected-paths config; path guard; symlink check; filesystem audit; diff gate; promotion gate; typecheck/build/preview-health/pm2-status/product-sample-parser modules; retention GC; context builder; instruction loader; milestone mapper; SSE event union types. These are shared across all user stories — block all stories until done. |
| Phase 3+: User Story N | plan Phase 4 + 6 + 8 specific to each story | One template-phase block per user story (US1 → US8). Each block contains tests + implementation tasks for the story's specific lifecycle path: e.g. US1 = init batching + planning turn + multi-batch Codex thread; US3 = new-route planning turn + full build gate; US4 = repair loop wiring; US5 = boundary fail-closed end-to-end; etc. Reuse the foundational modules; do not re-create them per story. |
| Final: Polish | plan Phase 7 (cleanup) + plan Phase 8 (verification) | Delete `src/features/ai-agent/*` remnants, taste-skill loader/preload, `flags.tasteSkillLoaded` references, `project_read_taste_skill`. Final lint/typecheck pass. Manual VPS smoke per plan Phase 8 checklist. Update `docs/deploy-vps.md` callouts if anything drifted. |

### Per-story coverage checklist (use this to verify nothing is missed)

For each US, the implementation block must include at least one task each (where applicable) for:

- API route handler (`src/routes/api/projects/$projectId/builder-runs/...`)
- Lifecycle wiring inside `runtime/builder-run.server.ts`
- UI integration in `src/routes/projects/$projectId/*` (event consumption, status surface, i18n strings)
- Unit tests for the story-specific logic
- One integration test (`tests/integration/agents/codex/<story>.test.ts`) that mocks `@openai/codex-sdk`

Story-specific must-have tasks:

- **US1 init**: batch planner skeleton; foundation/data → page → polish turn orchestration; per-batch 40-file gate; manifest-driven page list; `productsListSample` smoke check wiring.
- **US2 small update**: skip-planning fast path; skip-build promotion when typecheck + preview health pass; 20-file diff gate.
- **US3 new route**: planning-turn enforcement for new-route classification; full build gate; preview health URL list extension with the new route.
- **US4 repair**: same-thread re-feed of validation summary; 2-cycle cap with `repair_exhausted` failure code.
- **US5 boundary**: integration test exercising path traversal + symlink escape + diff-gate violation; project-level suspension counter; restricted retention path.
- **US6 cancel**: AbortController plumbed from API endpoint to `cancel-controller.server.ts`; idempotent cancel; 12h retention.
- **US7 unavailable**: env validation at startup; feature flag → unavailable banner; non-builder pages still render; localized banner copy (vi primary, en fallback).
- **US8 concurrency**: per-project active-run lock; rejection response shape; no queueing.

### Required cross-cutting items in Polish phase

- Delete legacy paths listed in plan Phase 7.
- Verify no remaining importer of `taste-skill-loader.server.ts`, `taste-skill-preload.server.ts`, `flags.tasteSkillLoaded`, `project_read_taste_skill`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` — full pass.
- Manual smoke against staging (the 7-step checklist in plan Phase 8) — turn each step into a task.

### Constraints to repeat verbatim in tasks.md "Notes" section

- Phase 0 (spec, plan, grill sync, deploy doc) is already done — not in this task list.
- Skill runtime is deferred; only forward-compat extension points are in scope.
- `git mv` is required for template migration (preserves history).
- No raw prompt / raw diff / full file content in any log or persisted metadata.
- Drizzle JSON columns use `json()`, not `jsonb()` (Constitution IX).
- All cross-folder imports use `@/` or `@app/` (Constitution X).

### Format expectations (matches the template)

```
# Tasks: Codex SDK Migration

**Input**: Design documents from `/specs/025-codex-sdk-migration/`
**Prerequisites**: plan.md, spec.md, docs/codex-sdk-migration-grill-summary.md, skill-runtime-discussion-summary.md

**Tests**: Required (Constitution Principle II) for boundary enforcement, validation gates, repair loop, product-sample parser, retention scheduler, milestone mapper.

**Organization**: Tasks grouped by user story (US1–US8) for independent implementation.

## Phase 1: Setup
…
## Phase 2: Foundational
…
## Phase 3: User Story 1 — Init a new retail storefront (P1) 🎯 MVP
### Tests for User Story 1
…
### Implementation for User Story 1
…
**Checkpoint**: …

…

## Phase N: Polish & Cross-Cutting
…

## Dependencies & Execution Order
…

## Notes
…
```

### Sanity check before emitting

Re-read this prompt and verify the output:

1. Every FR (FR-001 → FR-048) is covered by at least one task. Trace each FR to its task ID in a brief table at the end of the file (`## Coverage Map`), grouped by FR range.
2. Every user story (US1 → US8) has a phase block with tests + implementation + checkpoint.
3. No placeholder / template scaffolding remains.
4. Sequential `T001` → `T<last>` numbering, no gaps.
5. Skill-runtime-only tasks are absent; forward-compat tasks are present.

If any check fails, fix before emitting.
