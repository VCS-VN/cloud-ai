# Implementation Prompt — Skill Runtime (Phase 2)

Self-contained prompt for executing `specs/026-skill-runtime-phase/tasks.md` end-to-end. Designed for a single conversation that may span multiple turns; the prompt is the orchestrator and decides when to fan out to sub-agents.

---

## Prompt to send

You are implementing the Generic Skill Runtime (Phase 2) for the cloud-ai project. This builds on top of the Phase 1 builder-runs stack (`specs/025-codex-sdk-migration/`, branch `025-codex-sdk-migration`, commit `69c6379`) which shipped the Codex SDK builder runtime with stable extension points for skills. Your job is to execute every task in `specs/026-skill-runtime-phase/tasks.md` (T001 → T060) across 8 phases, in the order they appear, with sub-agent fan-out where the rules below permit. You are the orchestrator. You make all phase-boundary decisions, verify gates, and commit decisions; sub-agents only do isolated file work.

### Required reading (read in full before writing any code)

1. `specs/026-skill-runtime-phase/spec.md` — 5 user stories (3× P1, 2× P2), 47 FRs, 10 SCs, locked decisions.
2. `specs/026-skill-runtime-phase/plan.md` — module layout under `src/features/agents/codex/skills/*`, Constitution Check, 9 sub-phases, risks + out-of-scope.
3. `specs/026-skill-runtime-phase/tasks.md` — T001–T060, FR coverage map (single source of truth for what to build).
4. `specs/026-skill-runtime-phase/research.md` — 11 ancillary decisions including parser library, content cap, tie-break LLM dispatch, scanner sources, inline directive grammar, state machine, schema migration shape, tool registration, locale strategy, test boundary, seed skill provenance.
5. `specs/026-skill-runtime-phase/data-model.md` — schema delta + entity shapes + state transitions.
6. `specs/026-skill-runtime-phase/contracts/answer-endpoint.md` — POST /builder-runs/$runId/answer contract.
7. `specs/026-skill-runtime-phase/contracts/project-read-skill-tool.md` — Codex tool input/output schema + boundary guarantees.
8. `specs/026-skill-runtime-phase/contracts/selected-skill-wrapper.md` — `<selected_skill>` wrapper format + ordering + audit hash invariant.
9. `specs/026-skill-runtime-phase/quickstart.md` — operator smoke checklist mapping every step to a success criterion.
10. `skill-runtime-discussion-summary.md` — original full design.
11. `docs/codex-sdk-migration-grill-summary.md` — section "Codex SDK Flow Alignment With Skill Runtime" for forward-compat constraints.
12. `specs/025-codex-sdk-migration/spec.md` FR-043–FR-047 — forward-compat slots reserved by Phase 1.
13. `specs/025-codex-sdk-migration/plan.md` Phase 1 module layout — to understand where the Phase 2 modules slot in alongside existing Phase 1 code.
14. `.specify/memory/constitution.md` — must obey all 10 principles.
15. `CLAUDE.md` and `MEMORY.md` — user preferences. Notably: pre-production destructive migrations OK; design-taste-frontend skill is the runtime gap acknowledged in `project_skill_runtime_gap.md`.

### Hard constraints (non-negotiable)

- **Source of truth = `tasks.md`**. If a task description disagrees with this prompt, follow the task. If a task disagrees with `spec.md`, surface the conflict and ask before proceeding.
- **Never skip a task**, never reorder phases, never compress two phases into one. Every T-id must end in a `[x]`-checked box in `tasks.md` exactly once.
- **Verify gate after every phase**: run `pnpm typecheck && pnpm lint && pnpm test`. All three must pass before moving to the next phase. (`pnpm lint` and `pnpm typecheck` are the same `tsc --noEmit` invocation in this project's package.json — both must succeed.) If any fails, fix the root cause inside the current phase — do not move on.
- **Commit cadence**: one commit per phase, message format `feat(skill-runtime): phase N — <phase title>` (Phase 1 Setup, Phase 2 Foundational, Phase 3 US1, …, Phase 8 Polish). Tick the task checkboxes in `tasks.md` in the same commit. Never amend a previous commit.
- **No raw SKILL.md content in logs or persisted metadata** (FR-038). Audit your own code as you write it. Hash + name + score + source + loaded flag only.
- **Drizzle JSON columns use `json()`, not `jsonb()`** (Constitution IX). Cross-folder imports use `@/` or `@app/` (Constitution X).
- **`<selected_instruction>` (Phase 1) and `<selected_skill>` (Phase 2) coexist on the same context bundle**. Do NOT remove or rename `<selected_instruction>` anywhere. Phase 2 ADDS a parallel pathway.
- **Skill registry is boot-time-only** (FR-006). No hot-reload, no watch handlers. Registry rebuild requires app restart.
- **Phase 2 ADDS columns to `builder_runs`**. Do not drop, rename, or repurpose any Phase 1 column. `selectedInstructions[]` and `pendingInstructions[]` stay untouched.
- **Out of scope**: rewriting the legacy AI Agent UI (`src/routes/projects/$projectId.tsx` and siblings); deleting `src/features/ai-agent/*` or dropping `agent_runs`. Both belong to the deferred Phase 11 follow-up of `025-codex-sdk-migration`. SC-009 verifies via `git diff --stat` that this branch touched none of those paths.
- **`project_read_skill` tool is bounded to the registry**. It MUST NOT touch the filesystem outside `registry.getSkill()`. Path-traversal-shaped names MUST return `invalid_name` structured errors and audit log records.
- **LLM tie-break sends metadata only — never SKILL.md body** (FR-013). Inspect the prompt the tie-break code sends to verify.
- **Clarification pause happens BEFORE draft creation**. The invariant is "draft directory exists ⇒ orchestrator has fully committed to a skill set". Audit your `builder-run.server.ts` extension carefully.
- **If the user has not given explicit permission for a destructive op** (Phase 8 deletions or unusual schema rewrites), pause and confirm before executing. The task list is approval *to plan* the changes, not blanket approval to execute risky operations mid-stream. (Phase 2 is mostly additive — this should rarely trigger.)

### Sub-agent fan-out rules

Sub-agents are useful for isolated file work. They are NOT useful for cross-cutting orchestration. Apply these rules strictly:

**Spawn a sub-agent only when ALL of the following are true:**

1. The task targets a single new file or a single existing file that no other in-flight sub-agent is touching.
2. The task has no dependency on another in-flight task in the same phase.
3. The task is marked `[P]` in `tasks.md`, OR you have verified independent file ownership manually.
4. The sub-agent's prompt is fully self-contained — file path, function signature, return type, edge cases, and a one-line verification command (or "no verification needed, types will catch it").

**Never spawn a sub-agent for:**

- Anything that edits `src/features/agents/codex/runtime/builder-run.server.ts` — single file, multiple writers across phases (T029, T035, T043, T046). Always do this yourself, sequentially.
- Schema migrations (`src/db/schema.ts`, `src/db/schema/builder-runs.schema.ts`, `src/db/migrations/*`) — single timeline.
- The selection orchestrator (`selection.server.ts`) once it lands — extended in T045 by US4.
- The codex-thread tool registration (`codex-thread.server.ts`) — single file, T042 owns the extension.
- Phase boundaries, verify gates, commits.
- Any task that requires reading > 3 files of context to understand — by the time you brief the agent, you've already done the work.

**Cap concurrency at 4 sub-agents.** Beyond that, sub-agent overhead exceeds savings, and review of returned diffs becomes the bottleneck.

**After every fan-out:** read the actual diffs the sub-agents produced. Their summaries describe intent; the diff is what landed. Trust-but-verify.

### Phase execution playbook

For each phase:

1. **Read the phase block in `tasks.md`** to refresh on task IDs and file paths.
2. **Plan the wave structure** — sequential tasks first (or any task that gates downstream work), then `[P]` waves after their prerequisites land.
3. **Execute waves**:
   - Sequential tasks: do them yourself.
   - `[P]` waves: spawn ≤ 4 sub-agents per wave following the rules above. Wait for all to finish, read every diff, then move to the next wave.
4. **Run the verify gate** (`pnpm typecheck && pnpm lint && pnpm test`).
5. **Tick checkboxes** in `tasks.md` for every completed T-id in this phase.
6. **Commit** with the standard message.
7. **Report** to the user: phase number, tasks completed (count + ID range), verify result, commit SHA, and what's next.

### Phase-specific guidance

**Phase 1 (Setup, T001–T008)**: Mostly skeleton + env additions. Recommended waves:

- Wave 1A: T001 + T002 (skeleton dirs, you only).
- Wave 1B: T003–T008 in parallel — 6 sub-agents disjoint files. After this wave the env consumes `SKILLS_ROOT`, `MAX_SKILL_CHARS`, `LLM_TIE_BREAK_GAP`, `MAX_SELECTED_SKILLS`; `BuilderRunMilestone` and `BuilderRunFailureCode` enums extended; locale strings added.

After commit, the working tree should typecheck even though no behavioral change has happened.

**Phase 2 (Foundational, T009–T024)**: The biggest phase. Recommended waves:

- Wave 2A: T009 + T010 (schema, sequential — you only). Run `pnpm db:generate` to produce the migration, verify columns + defaults match data-model.md.
- Wave 2B: T011 + T014 in parallel (parser + scanner — sub-agents). Each is one file, no overlap.
- Wave 2C: T012 (loader, depends on parser).
- Wave 2D: T013 (registry, depends on loader).
- Wave 2E: T015–T018 in parallel (4 unit tests — sub-agents).
- Wave 2F: T019 + T020 in parallel (detector + tie-break — sub-agents).
- Wave 2G: T021 (selection orchestrator, depends on detector + tie-break).
- Wave 2H: T022–T024 in parallel (3 unit tests — sub-agents).

After verify gate passes, commit Phase 2.

**Phases 3–7 (User Stories, T025–T049)**: Each phase touches `builder-run.server.ts`. Process stories one at a time. Within each story:

- Tests first (parallel via sub-agents if `[P]`-marked).
- Implementation tasks: orchestration in `builder-run.server.ts`, `selection.server.ts`, `codex-thread.server.ts` is yours; sub-agents only for new files (`injection.server.ts`, `clarification.server.ts`, `project-read-skill.tool.server.ts`, API handler, UI components).
- Verify gate. Commit.

Story dependency notes:

- **US1 (T025–T031)** is the MVP: foundation injection. After this commit, every init run auto-applies `design-taste-frontend`. Do this first; SC-001 must hold.
- **US2 (T032–T039)** depends on US1 because the clarification path edits the same `builder-run.server.ts`. T035 introduces the pause-before-draft branch. Land US1 commit first.
- **US3 (T040–T043)** depends on US1 because the tool registration in `codex-thread.server.ts` needs the run handle to record `loadedSkills[]`. Land US1 first.
- **US4 (T044–T047)** depends on US2 because T046 piggybacks on the same selection orchestrator + builder-run extension US2 introduced. Land US2 first.
- **US5 (T048–T049)** is mostly an audit + small fix on the registry from T013. Independent of US1–US4.

Recommended sequence: Phase 1 → Phase 2 → US1 → US2 → US3 → US4 → US5 → Polish. Don't parallelize across user-story phases.

**Phase 8 (Polish, T050–T060)**: T050–T054 wire the SSE event variant + run the quality gate (you only). T055–T059 are manual VPS smoke checks the operator runs after deploy — present each as a checklist item the user must confirm; you cannot execute them remotely. T060 is a `git diff --stat` SC-009 verification you run yourself.

### Stop-on-blocker

Pause and ask the user immediately if you encounter any of the following:

- A spec/plan/tasks contradiction.
- A required external resource is missing (e.g. Codex SDK provider config unavailable when implementing the tie-break call, env var schema unknown).
- A test reveals an FR is ambiguous (e.g. "what counts as a 'description keyword cluster' match"); ask before guessing.
- A file you need to edit is held by an in-flight sub-agent (race avoidance).
- A destructive operation with no prior explicit user OK in this session (Phase 2 should not have many; flag if any arise).
- Three consecutive task attempts on the same root cause have failed — stop, diagnose, ask.

Do not invent answers. Do not skip tasks to avoid asking.

### Reporting cadence

- After each wave inside a phase: one-line status (`wave 2B done: T011, T014 landed, 2 sub-agents`).
- After each phase: structured report (phase, T-id range, verify result, commit SHA, next phase).
- After Phase 8: a final wrap with full FR coverage check (re-read `## Coverage Map` in `tasks.md` and confirm every entry has a checked task), unit/integration test counts, and remaining manual smokes (T055–T059) the user needs to run.

### Forbidden behaviors

- Do not run `git push --force`, `git reset --hard`, `git clean -fd`, or `rm -rf` outside a task's explicit instruction.
- Do not skip `pnpm lint` because "the previous phase's lint passed" — modules from a later phase can break earlier files via type narrowing.
- Do not declare a phase complete on the basis of "tests pass" alone — `pnpm typecheck` and `pnpm lint` are equally gating.
- Do not delete or rename anything under `src/features/ai-agent/*`, `src/routes/projects/$projectId.tsx`, `src/routes/dashboard/`, `src/routes/projects/index.tsx`, `src/routes/projects/starred.tsx`, or `src/components/projects/ProjectSettingsInfoTab.tsx`. SC-009 verifies this is honored. Out-of-scope per spec.
- Do not over-engineer. If a task says "implement function X with signature Y", do exactly that. No extra abstractions, no helper layers, no "for future flexibility". Constitution Principle IV.
- Do not write doc comments unless the WHY is non-obvious. Constitution: code is read, not narrated.
- Do not migrate the existing Phase 1 foundation templates into skills wholesale. That conversion is opt-in, one foundation block at a time, in follow-up PRs (see plan.md "Out of Scope (Phase 2)").

### First action

1. Read every required-reading document in full.
2. Run `pnpm install` to confirm the working tree builds before you start (`pnpm typecheck` baseline).
3. Confirm the current branch is `026-skill-runtime`. If not, ask the user before switching or creating.
4. Verify `git log --oneline -5` shows recent Phase 2 spec/plan/tasks commits (most recently `b38b7c7` for tasks.md). The implementation builds on top of those.
5. Begin Phase 1 Wave 1A.

---

## How to use this prompt

- Save it as `specs/026-skill-runtime-phase/implement-prompt.md` (already done if you're reading this in-repo).
- Open a fresh implementation session. Paste the **Prompt to send** section into the first turn.
- Let the orchestrator drive. Answer pause-and-ask questions promptly to keep momentum.
- After each phase commit, you may interrupt to review or pause indefinitely; the next session can resume by re-pasting the prompt and pointing at the next unchecked T-id.
