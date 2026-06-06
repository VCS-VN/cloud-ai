# Implementation Prompt — Codex SDK Migration

Self-contained prompt for executing `specs/025-codex-sdk-migration/tasks.md` end-to-end. Designed for a single conversation that may span multiple turns; the prompt is the orchestrator and decides when to fan out to sub-agents.

---

## Prompt to send

You are implementing the Codex SDK migration for the cloud-ai project. Your job is to execute every task in `specs/025-codex-sdk-migration/tasks.md` (T001 → T112) across 11 phases, in the order they appear, with sub-agent fan-out where the rules below permit. You are the orchestrator. You make all phase-boundary decisions, verify gates, and commit decisions; sub-agents only do isolated file work.

### Required reading (read in full before writing any code)

1. `specs/025-codex-sdk-migration/spec.md` — 8 user stories, 48 FRs, key entities, success criteria.
2. `specs/025-codex-sdk-migration/plan.md` — module layout, 9-phase roadmap, Constitution Check, risks, out-of-scope.
3. `specs/025-codex-sdk-migration/tasks.md` — T001–T112, FR coverage map (single source of truth for what to build).
4. `docs/codex-sdk-migration-grill-summary.md` — final grill decisions for the Codex SDK builder.
5. `skill-runtime-discussion-summary.md` — forward-compat constraints only; do not implement skill runtime.
6. `docs/deploy-vps.md` — env, paths, ops expectations.
7. `.specify/memory/constitution.md` — must obey all 10 principles.
8. `CLAUDE.md` and any `MEMORY.md` entries — user preferences.

### Hard constraints (non-negotiable)

- **Source of truth = `tasks.md`**. If a task description disagrees with this prompt, follow the task. If a task disagrees with `spec.md`, surface the conflict and ask before proceeding.
- **Never skip a task**, never reorder phases, never compress two phases into one. Every T-id must end in a `[x]`-checked box in `tasks.md` exactly once.
- **Verify gate after every phase**: run `pnpm typecheck && pnpm lint && pnpm test`. All three must pass before moving to the next phase. If any fails, fix the root cause inside the current phase — do not move on.
- **Commit cadence**: one commit per phase, message format `feat(codex): phase N — <phase title>` (Phase 1 Setup, Phase 2 Foundational, Phase 3 US1, …, Phase 11 Polish). Tick the task checkboxes in `tasks.md` in the same commit. Never amend a previous commit.
- **No prompts, diffs, or full file contents in logs or persisted metadata** (FR-019, FR-040). Audit your own code as you write it.
- **Drizzle JSON columns use `json()`, not `jsonb()`** (Constitution IX). Cross-folder imports use `@/` or `@app/` (Constitution X).
- **Pre-production destructive migrations are OK** (per memory: `project_pre_production`). No data backfill, no historical migration. But schema changes still go through Drizzle migrations, not raw SQL.
- **Skill runtime is out of scope.** Forward-compat extension points only: `<selected_instruction>` wrapper, `selectedInstructions[] / pendingInstructions[]` schema fields, `SKILLS_ROOT` env reservation. No skill detector, no scoring, no `project_read_skill`, no clarification flow.
- **If the user has not given explicit permission for a destructive op** (Phase 11 deletions of large folders, force-push, schema drop), pause and confirm before executing. The task list is approval _to plan_ the deletions, not a blanket approval to execute them mid-stream.

### Sub-agent fan-out rules

Sub-agents are useful for isolated file work. They are NOT useful for cross-cutting orchestration. Apply these rules strictly:

**Spawn a sub-agent only when ALL of the following are true:**

1. The task targets a single new file or a single existing file that no other in-flight sub-agent is touching.
2. The task has no dependency on another in-flight task in the same phase.
3. The task is marked `[P]` in `tasks.md`, OR you have verified independent file ownership manually.
4. The sub-agent's prompt is fully self-contained — file path, function signature, return type, edge cases, and a one-line verification command (or "no verification needed, types will catch it").

**Never spawn a sub-agent for:**

- Anything that edits `src/features/agents/codex/runtime/builder-run.server.ts` — single file, many writers across phases. Always do this yourself, sequentially.
- Schema migrations (`src/db/schema.ts`, `src/db/migrations/*`) — single timeline.
- `git mv` operations — chain ordering matters.
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

**Phase 1 (Setup, T001–T014)**: Mostly `git mv` chains and dependency installation. Do T001–T008 sequentially. T009/T012/T013/T014 can fan out (skeleton files in disjoint folders). T010 + T011 share env handling but live in different files — do T010 first, then T011 references the validated env. After commit, the working tree should typecheck even though no behavioral change has happened.

**Phase 2 (Foundational, T015–T045)**: The biggest phase. Recommended wave plan:

- Wave 2A: T015 + T016 (schema, sequential, you only).
- Wave 2B: T017–T019 in parallel (3 sub-agents, neutral infra moves).
- Wave 2C: T020 (you only — protected paths config drives downstream tests).
- Wave 2D: T021–T025 in parallel (5 boundary modules, sub-agents).
- Wave 2E: T026–T030 in parallel (5 validation modules).
- Wave 2F: T031 (retention) + T032 (instruction loader) + T033 (project summary) — different files, parallel.
- Wave 2G: T034 (context builder) + T035 (milestone mapper) — parallel.
- Wave 2H: T036 (codex thread) — you only, single critical file.
- Wave 2I: T037–T045 in parallel (9 unit tests, after their target modules exist).

After verify gate passes, commit Phase 2.

**Phases 3–10 (User Stories, T046–T091)**: Each phase touches `builder-run.server.ts`. Process stories one at a time. Within each story:

- Tests first (parallel via sub-agents if `[P]`-marked).
- Implementation tasks: orchestration in `builder-run.server.ts` is yours; sub-agents only for new files (API handlers, UI components, helper modules).
- Verify gate. Commit.

Do not start US2 implementation until US1 commit lands. Do not parallelize across user-story phases.

**Phase 11 (Polish, T092–T112)**: T092–T099 are deletions of large folders. Pause and ask the user to confirm before each deletion wave. After deletions, T100 grep-verify zero remaining importers — be exhaustive. T101 is a Drizzle migration to drop now-unused columns. T102–T104 quality gate. T105–T112 manual VPS smokes — present each as a checklist item the user has to confirm; you cannot execute them remotely. The final commit lands once the user confirms all smokes passed.

### Stop-on-blocker

Pause and ask the user immediately if you encounter any of the following:

- A spec/plan/tasks contradiction.
- A required external resource is missing (e.g. `@openai/codex-sdk` not yet published, env var schema unknown).
- A test reveals an FR is ambiguous (e.g. "what counts as 'identity-impacting' summary"); ask before guessing.
- A file you need to edit is held by an in-flight sub-agent (race avoidance).
- A destructive operation (Phase 11) with no prior explicit user OK in this session.
- Three consecutive task attempts on the same root cause have failed — stop, diagnose, ask.

Do not invent answers. Do not skip tasks to avoid asking.

### Reporting cadence

- After each wave inside a phase: one-line status (`wave 2D done: T021–T025 landed, 5 sub-agents`).
- After each phase: structured report (phase, T-id range, verify result, commit SHA, next phase).
- After Phase 11: a final wrap with full FR coverage check (re-read `## Coverage Map` in `tasks.md` and confirm every entry has a checked task), unit/integration test counts, and remaining manual smokes (if any).

### Forbidden behaviors

- Do not run `git push --force`, `git reset --hard`, `git clean -fd`, or `rm -rf` outside the explicit Phase 11 task list.
- Do not skip `pnpm lint` because "the previous phase's lint passed" — modules from a later phase can break earlier files via type narrowing.
- Do not declare a phase complete on the basis of "tests pass" alone — `pnpm typecheck` and `pnpm lint` are equally gating.
- Do not over-engineer. If a task says "implement function X with signature Y", do exactly that. No extra abstractions, no helper layers, no "for future flexibility". Constitution Principle IV.
- Do not write doc comments unless the WHY is non-obvious. Constitution: code is read, not narrated.

### First action

1. Read every required-reading document in full.
2. Run `pnpm install` to confirm the working tree builds before you start (`pnpm typecheck` baseline).
3. Confirm the current branch. If on `main`, ask the user whether to create branch `025-codex-sdk-migration` first or stay on the current branch.
4. Begin Phase 1 Wave A.

---

## How to use this prompt

- Save it as `specs/025-codex-sdk-migration/implement-prompt.md` (already done if you're reading this in-repo).
- Open a fresh implementation session. Paste the **Prompt to send** section into the first turn.
- Let the orchestrator drive. Answer pause-and-ask questions promptly to keep momentum.
- After each phase commit, you may interrupt to review or pause indefinitely; the next session can resume by re-pasting the prompt and pointing at the next unchecked T-id.
