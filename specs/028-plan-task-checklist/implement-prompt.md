# Implementation Prompt — Plan Task Checklist

Self-contained prompt for executing `specs/028-plan-task-checklist/tasks.md` end-to-end. Designed for a single conversation that may span multiple turns; the prompt is the orchestrator and decides when to fan out to sub-agents.

---

## Prompt to send

You are implementing the Plan Task Checklist feature for the cloud-ai project. Your job is to execute every task in `specs/028-plan-task-checklist/tasks.md` (T001 → T044) across 9 phases, in the order they appear, with sub-agent fan-out where the rules below permit. You are the orchestrator. You make all phase-boundary decisions, verify gates, and commit decisions; sub-agents only do isolated file work.

### Required reading (read in full before writing any code)

1. `specs/028-plan-task-checklist/spec.md` — 6 user stories, 17 FRs, 7 SCs, edge cases, constitution alignment.
2. `specs/028-plan-task-checklist/plan.md` — sequence diagrams, file roadmap, 9-phase structure, risk register, validation plan.
3. `specs/028-plan-task-checklist/data-model.md` — exact shapes for `progressTimeline` variants, `BuilderRunHandle` extension, `RunStreamEvent` additions, classifier/planner I/O, milestone→bucket mapping.
4. `specs/028-plan-task-checklist/tasks.md` — T001–T044, single source of truth for what to build.
5. `specs/028-plan-task-checklist/quickstart.md` — 10 manual scenarios; Phase 9 references it.
6. `CLAUDE.md` (project instructions) — must-read; covers retention rules around legacy chat path and the constitution alignment used in this repo.
7. `MEMORY.md` entries the harness exposes — user preferences (price-in-cents, pre-production status, prompt patterns).
8. `src/features/agents/codex/runtime/codex-thread.server.ts` — to understand the existing `BoundedCodexThread.runTurn` retry loop that classifier and planner inherit.
9. `src/features/agents/codex/runtime/design-variants.server.ts` — to copy the `stripCodeFence` + validator-retry pattern; the planner reuses this shape.
10. `src/server/services/builder-run-translator.server.ts` and `src/server/services/builder-run-bridge.server.ts` — to understand the BuilderRunEvent → RunStreamEvent translation seam you will extend.
11. `src/features/agents/ui/agent-event-reducer.ts` and `src/features/agents/ui/use-chat-stream.ts` — the FE reducer/hook you will extend with 5 new task event cases.
12. `src/routes/api/projects/$projectId/builder-runs/$runId/stream.ts` — archive replay path you will extend in Phase 7.

### Hard constraints (non-negotiable)

- **Source of truth = `tasks.md`**. If a task description disagrees with this prompt, follow the task. If a task disagrees with `spec.md` or `data-model.md`, surface the conflict and ask before proceeding.
- **Never skip a task**, never reorder phases, never compress two phases into one. Every T-id must end in a `[x]`-checked box in `tasks.md` exactly once.
- **Verify gate after every phase**: run `pnpm typecheck && pnpm lint && pnpm vitest run`. All three must pass before moving to the next phase. If any fails, fix the root cause inside the current phase — do not move on.
- **Commit cadence**: one commit per phase, message format `feat(plan-checklist): phase N — <phase title>` (e.g. `phase 1 — foundational types`, `phase 2 — server LLM modules`, …, `phase 9 — integration & manual verify`). Tick the task checkboxes in `tasks.md` in the same commit. Never amend a previous commit.
- **No prompts, diffs, or full file contents in logs or persisted metadata.** Privacy filter (`isPrivacySafe`) MUST reject any task title that contains a file path, framework name, or code identifier. FR-003 is enforced server-side; do not weaken it for "edge cases".
- **Drizzle JSON columns use `json()`, not `jsonb()`** (Constitution IX). No SQL migration is required for this feature — `progress_timeline` already uses `json()`. The discriminated union widens at the TypeScript layer only.
- **Cross-folder imports use `@/...` aliases** (Constitution X).
- **Pre-production destructive operations are OK** per memory (`project_pre_production`). For this feature that means: deleting `BuilderRunProgress.tsx` + `useBuilderRunStream.ts` in Phase 8 is approved policy. But still verify zero callers (T036) before each delete.
- **Plan-mode (markdown approval) is preserved unchanged.** When `ctx.planMode === true`, `runPlanGenerationPhase` MUST be skipped entirely — no classifier, no planner, no `plan.created` event. Do not refactor `plan-mode.server.ts`. Do not touch the markdown plan flow.
- **Lenient fallback on plan failure (FR-009).** Classifier failure → default `{ complexity: "complex", language: "en" }`. Planner failure → silently skip checklist, run continues. Never fail a run because of plan-feature failure. The user's run must complete or fail for a real reason, not for a plan-decoration reason.
- **Publish-first ordering (FR-006).** `publishBuilderRunEvent(...)` MUST run before `appendProgressTimelineEvent(...)`. This is a documented trade-off; do not silently re-order. Code comment required at each call site referencing FR-006.
- **AbortSignal propagation (FR-010).** Both classifier and planner turns MUST observe `ctx.signal`. The `BoundedCodexThread.runTurn` retry loop already throws `AbortError` immediately without retry; do not catch and swallow it.
- **English UI strings, LLM-detected language for task titles.** Task titles match the user prompt's language as detected by the classifier (with EN fallback). UI infrastructure text (`role` labels, `aria-label`, status text, header labels) is hardcoded English. Mixed-language UI is the explicit MVP decision (grill Câu 14/15 + G6).
- **No new HTTP endpoints.** This feature ships only SSE event types and persistence variants. The existing `/api/projects/$projectId/builder-runs/...` routes already cover the data path.
- **No new accessibility primitives.** Reuse `aria-live`, `aria-busy`, `role="list"/listitem"`, `aria-expanded` per existing repo patterns (`MessageComposer.tsx`, `HomePromptForm.tsx`, `BuilderUnavailableBanner.tsx`).
- **Autonomous execution is approved.** The user is not watching. Do not pause for confirmation on routine operations: file edits, file creation, file deletion within the Phase 8 scope (`BuilderRunProgress.tsx` + `useBuilderRunStream.ts` + `index.ts` re-export edits), `git add`, `git commit`, `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm vitest run`, `git checkout -b 028-plan-task-checklist`, sub-agent spawning under the rules below. Proceed straight through phase commits without check-ins.
- **Hard-stop only for genuinely destructive ops outside the approved scope.** Even with autonomous approval, STOP and surface a one-line summary if you would: `git push --force` (any), `git reset --hard` (any), `git clean -fd` (any), `rm -rf` outside the Phase 8 list, drop a database column, drop a table, write to `.env*`, modify CI/CD config, or modify any file outside the file roadmap in `plan.md`. These need an explicit user OK in this session.

### Sub-agent fan-out rules

Sub-agents are useful for isolated file work. They are NOT useful for cross-cutting orchestration. Apply these rules strictly:

**Spawn a sub-agent only when ALL of the following are true:**

1. The task targets a single new file or a single existing file that no other in-flight sub-agent is touching.
2. The task has no dependency on another in-flight task in the same phase.
3. The task is marked `[P]` in `tasks.md`, OR you have verified independent file ownership manually.
4. The sub-agent's prompt is fully self-contained — file path, function signature, return type, edge cases, the relevant section of `data-model.md` quoted inline, and a one-line verification command (or "no verification needed, types will catch it").

**Never spawn a sub-agent for:**

- Anything that edits `src/features/agents/codex/runtime/builder-run.server.ts` — single file, multiple writers across phases. Always do this yourself, sequentially.
- The reducer extension in `src/features/agents/ui/agent-event-reducer.ts` — single file with both the new task cases and existing skeleton/message cases; subtle interaction.
- Bridge orchestration files (`builder-run-bridge.server.ts`, dispatcher).
- Phase boundaries, verify gates, commits.
- Any task that requires reading > 3 files of context to understand — by the time you brief the agent, you've already done the work.

**Cap concurrency at 3 sub-agents.** This feature is small (44 tasks) and most parallel waves are 2-3 tasks wide; beyond 3 the review overhead exceeds savings.

**After every fan-out:** read the actual diffs the sub-agents produced. Their summaries describe intent; the diff is what landed. Trust-but-verify.

### Phase execution playbook

For each phase:

1. **Read the phase block in `tasks.md`** to refresh on task IDs and file paths.
2. **Plan the wave structure** — sequential tasks first (or any task that gates downstream work), then `[P]` waves after their prerequisites land.
3. **Execute waves**:
   - Sequential tasks: do them yourself.
   - `[P]` waves: spawn ≤ 3 sub-agents per wave following the rules above. Wait for all to finish, read every diff, then move to the next wave.
4. **Run the verify gate** (`pnpm typecheck && pnpm lint && pnpm vitest run`).
5. **Tick checkboxes** in `tasks.md` for every completed T-id in this phase.
6. **Commit** with the standard message.
7. **Report** to the user: phase number, tasks completed (count + ID range), verify result, commit SHA, and what's next.

### Phase-specific guidance

**Phase 1 (Foundational schemas & types, T001–T005)**: Pure type changes. T001–T004 each touch a different file and can run as a single fan-out wave (3 sub-agents max — do T001 and T004 yourself, T002 and T003 in parallel). T005 is sequential — only you can run typecheck and triage errors. Expect zero runtime change after this phase; tests still pass because the new variants have no producer yet.

**Phase 2 (Server-side LLM modules, T006–T010)**: Wave plan:
- Wave 2A: T006 (classifier module) + T007 (planner module) in parallel — different files, no dependency.
- Wave 2B: T008 (classifier tests) + T009 (planner tests) in parallel — only after T006/T007 land.
- Wave 2C: T010 (run unit tests) — you only.

**Phase 3 (Helper orchestrator + driver wiring, T011–T017)**: This is the heaviest phase because T012–T016 all touch `builder-run.server.ts`. Process strictly sequentially:
- T011: create the orchestrator file (you only — single new file but tightly coupled to driver flow).
- T012: add the helper functions in builder-run.server.ts (you only).
- T013, T014, T015: wire `runPlanGenerationPhase` into each driver (you only, sequential — same file).
- T016: add `fireTaskTransitions` calls at every milestone fire site + clarification pause/resume + done flush (you only — same file, requires reading every existing milestone callsite).
- T017: typecheck (you only).

No sub-agents in Phase 3. The single-file constraint and the cross-cutting nature of the wiring make sub-agent overhead exceed savings.

**Phase 4 (Bridge translator pass-through, T018–T023)**:
- Wave 4A: T018 (translator cases) + T019 (ProgressTimelineDirective union) — same file, you only, sequential.
- Wave 4B: T020 (verify bridge persists new directives) — you only.
- Wave 4C: T021 (repo type narrowing if needed) — you only.
- Wave 4D: T022 (translator unit tests) — fan-out OK if you've done T018-T021. Otherwise you only.
- Wave 4E: T023 (verify) — you only.

**Phase 5 (Frontend reducer + stream hook, T024–T028)**:
- Wave 5A: T024 + T025 (reducer + RunUIState extension) — sequential, you only.
- Wave 5B: T026 (event listeners in useChatStream) — you only.
- Wave 5C: T027 (reducer tests) — fan-out OK.
- Wave 5D: T028 (verify) — you only.

**Phase 6 (Frontend UI component, T029–T032)**:
- T029 (PlanChecklist component) — you only. New file, ~150 lines, full ARIA semantics. Reference `MessageComposer.tsx` for `aria-live` pattern, but write the component yourself — sub-agents miss too many implicit conventions.
- T030 (index.ts re-export adjustments) — you only, but trivial.
- T031 (mount in $projectId.tsx) — you only.
- T032 (visual verification) — you only. If `pnpm dev` shows the checklist correctly on a complex prompt, mark T032 complete. If it does not render, do not paper over with workarounds; fix the root cause.

**Phase 7 (Archive replay, T033–T035)**:
- T033 + T034 — sequential, you only, same file.
- T035 — typecheck only.

**Phase 8 (Cleanup of dead code, T036–T040)**:
- T036 (verify zero callers) — MUST run the grep before any deletion. If grep returns any caller, STOP and ask the user. Do not delete with active callers.
- T037, T038, T039 — sequential deletions. Each must be a clean `git rm` (or fs delete + commit).
- T040 (verify build) — typecheck + lint clean. If build breaks, the deletion has hit a caller the grep missed; restore from git, regrep with broader pattern.

**Phase 9 (Integration test + manual verification, T041–T044)**:
- T041 (integration test) — you only. The test must mock the codex thread to return a deterministic classifier+planner output, then assert progressTimeline ordering.
- T042 (full vitest) — you only.
- T043 (typecheck + lint) — you only.
- T044 (quickstart manual checklist) — you only. Cannot be automated. Walk through `quickstart.md` Scenarios 1–10 on `pnpm dev`. Some scenarios (Scenario 9 server restart, Scenario 10 forced privacy leak) are optional/best-effort — flag them as such if you cannot reproduce locally.

### Stop-on-blocker

The user is NOT watching. Default behavior is to PROCEED, not to ask. Stop only when continuing would be unsafe or speculative. Specifically:

**Stop and surface a one-line summary** when:

- A destructive op outside the approved Phase 8 list comes up (force-push, reset --hard, recursive delete, schema drop, .env write, CI/CD modify, modify file outside `plan.md`'s file roadmap).
- Three consecutive task attempts on the same root cause have failed — diagnose the root cause, write a one-line summary, then STOP. Do not retry blindly.
- A spec/plan/tasks/data-model contradiction would force you to invent a behavior not specified anywhere.
- A required external resource is unreachable (codex SDK API down, env var missing, database unreachable) AND your task list cannot proceed past this point.

**DO NOT stop and ask** for any of these — proceed using the rules already given:

- An FR seems ambiguous → re-read `data-model.md` and the relevant grill decision in tasks.md context. The grill decisions resolved most ambiguity. Use the most conservative interpretation that satisfies the FR + grill decision and proceed. If still ambiguous after both passes, then it counts as a contradiction (above) — surface it.
- A test reveals a gap → fix the gap inside the current phase if it falls in the file roadmap; surface only if the fix would touch a file outside the roadmap.
- A grill decision feels suboptimal in hindsight → it was approved. Implement it as-decided. Do not relitigate.
- An LLM call returns weird output → that's why FR-009 is lenient. Apply the fallback path and continue.
- The classifier mislabels a prompt → log it (`plan_classifier_decision`) and proceed; the lenient fallback covers it.
- Pre-existing test failures unrelated to this feature → if they were present in the baseline run (First Action step 3), do NOT fix them in this PR. Note them in your final report and proceed.
- A typecheck error in a file outside the roadmap → most likely your changes widened a discriminated union and the consuming file needs the new case. That file is in scope by transitive inclusion. Proceed.

When you do stop: a single short summary, then wait. Do not loop. Do not retry. Do not invent.

### Reporting cadence (autonomous mode)

The user is not watching. Reports are for the user to read AFTER you finish, not real-time prompts they'll respond to. Be terse:

- After each wave inside a phase: one line in conversation (`wave 2A done: T006+T007 landed, 2 sub-agents`). No questions, no acknowledgement requests.
- After each phase: 4-line block — phase title, T-id range completed, verify result (`typecheck ok / lint ok / N tests pass`), commit SHA. Then proceed to next phase WITHOUT waiting.
- On stop-on-blocker conditions: one-line summary + the specific question (single sentence). Then halt.
- Final wrap (after Phase 9): full coverage check — for each FR in `spec.md`, name the test case or quickstart Scenario that covers it. List unit/integration test counts. List quickstart Scenarios as PASS / FAIL / BEST-EFFORT. Then halt.

Do not write progress narratives. Do not summarize what you did unless the phase boundary triggers it. Do not greet, do not sign off.

### First action (autonomous mode)

Proceed without waiting for confirmation:

1. Read every required-reading document in full.
2. Run `pnpm install` to confirm the working tree builds. If this fails because of a missing dep that ships in `package.json`, treat it as a baseline issue (note + proceed if possible).
3. Run `pnpm typecheck && pnpm lint && pnpm vitest run` to capture a baseline. Record any pre-existing failures as "BASELINE — out of scope for this PR" in a single one-line report.
4. Check current branch via `git rev-parse --abbrev-ref HEAD`. If on `main`, run `git checkout -b 028-plan-task-checklist`. If on another branch, stay on it (do not switch — the user may have set up the workspace deliberately).
5. Begin Phase 1 Wave A immediately. No "ready to start?" check-in.

### Forbidden behaviors

- Do not run `git push --force`, `git reset --hard`, `git clean -fd`, or `rm -rf` outside the explicit Phase 8 deletion list.
- Do not skip `pnpm lint` because "the previous phase's lint passed" — modules from a later phase can break earlier files via type narrowing.
- Do not declare a phase complete on the basis of "tests pass" alone — `pnpm typecheck` and `pnpm lint` are equally gating.
- Do not over-engineer. If a task says "implement function X with signature Y", do exactly that. No extra abstractions, no helper layers, no "for future flexibility". Constitution Principle IV.
- Do not write doc comments unless the WHY is non-obvious.
- Do not refactor `plan-mode.server.ts`. The markdown plan flow is preserved unchanged. Touching it is out of scope and risks regression.
- Do not introduce i18n infrastructure in this PR. UI text is hardcoded English; task content language is LLM-detected. Future i18n is a separate feature.
- Do not change `BuilderRunMilestone` enum values. The milestone→bucket map (data-model.md §7) assumes the existing enum. Adding/renaming a milestone is a separate breaking change.
- Do not add new persistence columns. The feature uses existing `progress_timeline json()` with two new discriminated-union variants. No SQL migration.

---

## How to use this prompt

- File location: `specs/028-plan-task-checklist/implement-prompt.md` (this file).
- Open a fresh implementation session. Paste the **Prompt to send** section into the first turn.
- Let the orchestrator drive. Answer pause-and-ask questions promptly to keep momentum.
- After each phase commit, you may interrupt to review or pause indefinitely; the next session can resume by re-pasting the prompt and pointing at the next unchecked T-id.
