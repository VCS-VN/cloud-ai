# Feature Specification: Plan Task Checklist

**Feature Branch**: `028-plan-task-checklist`
**Created**: 2026-06-08
**Status**: Draft
**Input**: User description: When a user submits a prompt, the agent should plan and break the work into tasks. The UI should display a checklist showing each task's status (pending, in progress, paused, completed) so the user can follow progress while the agent runs and avoid the boredom of waiting at a single static label.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User sees a task checklist while the agent works (Priority: P1)

A retailer submits a non-trivial prompt to build or update their storefront. Instead of seeing a single static label like "Đang dựng các trang" for 30+ seconds, they see a checklist of 2-8 short tasks with live status icons. As the agent progresses through phases, tasks tick from pending to in-progress to completed.

**Why this priority**: This is the core pain point being solved. Users wait 20-90 seconds for non-trivial runs and the current single-label UI provides no granular feedback, leading to perceived stalls and abandonment.

**Independent Test**: Submit a multi-step prompt (e.g., "Build a fashion store with cart and checkout"). Within 10 seconds, a checklist of 2-8 tasks must appear in the chat panel. As the run progresses, at least one task must transition from pending to in-progress and at least one task must reach completed before the run terminates.

**Acceptance Scenarios**:

1. **Given** a user submits a complex prompt for an init or update run, **When** the agent finishes loading context, **Then** a task checklist appears showing 2-8 tasks each with title and pending status icon.
2. **Given** a checklist is visible, **When** the run enters the build phase, **Then** at least one task transitions from pending to in-progress with an animated icon.
3. **Given** the run completes successfully, **When** all phases finish, **Then** every task in the checklist shows the completed icon.
4. **Given** a checklist is visible, **When** the user reloads the tab mid-run, **Then** the archived stream replay reproduces the same task list and statuses up to the most recent persisted transition.

---

### User Story 2 - Simple prompts skip the checklist and use the existing single-label UI (Priority: P1)

A user submits a trivial single-step prompt (e.g., "Fix the typo in the hero subtitle"). The classifier marks it simple, no task list is generated, and the existing single-label progress UI is used. The user is not delayed by an unnecessary planning turn for trivial work.

**Why this priority**: Showing a checklist for trivial prompts is over-information; it also adds latency to short runs. Classifier gating is the mechanism that keeps the feature proportional to prompt complexity.

**Independent Test**: Submit a one-step prompt to an existing project (e.g., "Đổi text hero thành Sale"). The chat panel must NOT render a checklist; the existing single-label progress UI must render instead. Wall-clock from prompt submit to first progress signal must remain comparable to runs without this feature.

**Acceptance Scenarios**:

1. **Given** a user submits a trivial prompt, **When** the classifier turn returns `simple`, **Then** no task list is generated, no `plan.created` stream event is emitted, and the chat panel renders the existing single-label progress UI.
2. **Given** the classifier fails after retry budget is exhausted, **When** the run continues, **Then** the system defaults to treating the prompt as complex (planner runs).
3. **Given** the planner fails after retry budget is exhausted, **When** the run continues, **Then** no checklist is rendered, the run executes with the single-label UI, and the run does not fail because of plan failure.

---

### User Story 3 - User can collapse the checklist to focus on chat (Priority: P2)

The user is reviewing chat history while a run is in progress. They want to focus on the conversation thread, not the checklist. They click the chevron in the checklist header to collapse it; the checklist becomes a single-line summary showing the active task and progress count. They click again to expand.

**Why this priority**: With 2-8 task rows, the checklist consumes 60-220 px of vertical space. On smaller viewports or during long-running tasks, the user needs to reclaim that space without losing run context.

**Independent Test**: Submit a complex prompt that produces a checklist. Click the checklist header chevron. The expanded list collapses to a single-line summary `◐ N/total: <active task title>`. Click again — the full list returns.

**Acceptance Scenarios**:

1. **Given** an expanded checklist, **When** the user clicks the header chevron, **Then** the list collapses to a single-line header showing the active task and progress count.
2. **Given** a collapsed checklist, **When** the user clicks the header chevron, **Then** the full list re-expands.
3. **Given** the run reaches a terminal state (completed/failed/interrupted), **When** the checklist is in either state, **Then** the header text reflects the terminal state (e.g., `✓ Completed N of N tasks`).

---

### User Story 4 - Tasks pause when the agent waits for user input (Priority: P2)

During a run, the agent emits an awaiting-clarification event (skill choice or design variant pick). The active task in the checklist transitions from in-progress to paused — the spinner stops, a pause icon appears. After the user answers, the active task resumes back to in-progress.

**Why this priority**: A spinning task icon while the agent is actually idle (waiting on user) is dishonest UX. Users have explicitly asked for honest progress signals ("không đoán bừa, không tự ảo giác"). Pause state matches reality.

**Independent Test**: Submit a prompt that triggers a skill clarification mid-run (e.g., one that requires a skill choice). When the clarification appears, the active task icon must transition from in-progress (animated) to paused (static pause icon). After the user answers, the icon returns to in-progress.

**Acceptance Scenarios**:

1. **Given** a task is in-progress, **When** the run emits `awaiting_clarification`, **Then** that task's icon transitions to paused without animation.
2. **Given** a task is paused, **When** the user submits the clarification answer, **Then** the task icon returns to in-progress.
3. **Given** a run is interrupted (server restart) while a task was in-progress or paused, **When** the user reloads, **Then** the task displays its last persisted status, the run is marked interrupted, and the spinner does not animate.

---

### User Story 5 - Plan mode keeps its markdown approval flow without extra task list (Priority: P2)

A power user toggles plan mode ON and submits a prompt. The agent returns a markdown plan and waits for approve/reject. The user reviews and approves. The execution phase begins with the existing single-label UI — no task list checklist is generated. The markdown plan is treated as the user's source of progress information.

**Why this priority**: Plan mode is an existing feature for power users to review intent before execution. Adding a task list on top is duplicate information. Skipping plan generation in plan mode also avoids one redundant LLM round-trip.

**Independent Test**: Toggle plan mode ON, submit a prompt. Markdown plan appears with approve/reject. Approve. The run executes WITHOUT generating a task list checklist; the existing single-label UI renders.

**Acceptance Scenarios**:

1. **Given** plan mode is ON, **When** the user submits a prompt, **Then** the markdown plan flow runs as today and no classifier or planner turn is invoked.
2. **Given** the user approves the markdown plan, **When** the execute phase starts, **Then** no `plan.created` event is emitted and the chat panel renders the existing single-label progress UI.
3. **Given** plan mode is OFF, **When** the user submits the same prompt, **Then** classifier+planner run and a task list checklist is rendered.

---

### User Story 6 - Task content respects user prompt language (Priority: P3)

A Vietnamese-speaking user submits a Vietnamese prompt. The agent's task titles appear in Vietnamese. An English-speaking user submits an English prompt. The task titles appear in English. Status labels and ARIA strings remain English (UI infrastructure language).

**Why this priority**: Task titles surface the user's intent at a glance. Generating them in a language the user does not speak undermines the value of the feature.

**Independent Test**: Submit a Vietnamese prompt for a complex run. Every task title in the rendered checklist must be in Vietnamese. Repeat with an English prompt — every task title must be English.

**Acceptance Scenarios**:

1. **Given** the classifier detects the prompt language as `vi`, **When** the planner generates tasks, **Then** every `task.title` is in Vietnamese.
2. **Given** the classifier returns an invalid or unrecognized language code, **When** the planner runs, **Then** task titles default to English.
3. **Given** any task list, **When** the checklist renders, **Then** the section landmark, status labels, and live-region announcements are in English regardless of task title language.

---

### Edge Cases

- **Plan generation fails after retry budget**: Planner retries up to 10 times with exponential backoff (existing `BoundedCodexThread.runTurn` retry mechanism). After exhaustion, the system silently skips the checklist and executes with the single-label UI. The run does not fail because of plan failure.
- **Cancel during plan generation**: User clicks Cancel while the classifier or planner turn is in flight. AbortSignal propagates; the run ends as cancelled. No task list is persisted because no `plan.created` event was published.
- **LLM returns invalid JSON or task list outside [2, 8]**: Validator retries the planner turn once. If still invalid, the system silently skips the checklist (lenient fallback).
- **LLM returns task with file paths or framework names in title**: Privacy filter (`isPrivacySafe`) rejects the task list. Validator retries once; if still invalid, skips the checklist.
- **All tasks fall in a single phase bucket (e.g., all `build`)**: Accepted. The translator no-ops on phase transitions where no tasks live. On run completion, all remaining non-completed tasks flush to completed.
- **Server restart mid-run**: Run is marked `interrupted` by `reconcileOrphanRuns`. On reload, the archive replay reproduces tasks up to the last persisted transition. Active tasks remain visually active but the spinner does not animate (run is closed). User retry creates a new run with a fresh planner turn.
- **Crash between publish and DB write (publish-first ordering)**: Live FE may have received a transition event that was not persisted. After restart, archive replay omits that transition; FE state on reload diverges from what live FE saw. Documented trade-off — publish-first chosen for live-feedback latency.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST run a classifier LLM turn before invoking the planner. Classifier MUST output `{ complexity: "simple" | "complex", language: ISO-639-1 string }`. Init kind bypasses the classifier and is always treated as complex with language `en` fallback.
- **FR-002**: When classifier returns `complex`, system MUST run a planner LLM turn that returns a JSON array of 2-8 tasks. Each task MUST have `{ id: string, title: string ≤ 80 chars, phase: "prep" | "build" | "verify" }`. IDs MUST be unique within the array.
- **FR-003**: Task titles MUST NOT contain file paths, framework names, or code identifiers. The privacy filter (`isPrivacySafe`) rejects task lists that violate this; the validator retries the planner once before falling back.
- **FR-004**: Planner MUST generate task titles in the language the classifier detected. If the language code is invalid, planner MUST default to English.
- **FR-005**: System MUST persist `task_plan` events to `progress_timeline` immediately when the planner output validates. Task transitions (`started`, `completed`, `paused`, `resumed`) MUST be persisted as `task_transition` events.
- **FR-006**: System MUST emit five new SSE event types: `plan.created`, `plan.task.started`, `plan.task.completed`, `plan.task.paused`, `plan.task.resumed`. The publish-to-channel MUST happen before the database write (publish-first ordering, documented trade-off).
- **FR-007**: When a milestone bucket transition occurs (`prep` → `build` → `verify`), system MUST mark all completed-bucket tasks as completed and start all entering-bucket tasks. When `awaiting_clarification` fires, all in-progress tasks MUST flip to paused. When the run resumes, paused tasks MUST flip back to in-progress.
- **FR-008**: When the run reaches `done`, system MUST flush all non-completed tasks to completed. When the run reaches `failed` or `cancelled`, system MUST NOT flip task statuses; the UI handles the closed state by stopping spinners.
- **FR-009**: Plan generation MUST NOT block the run. Failures (classifier or planner) MUST silently fall back to single-label UI without failing the run (lenient fallback).
- **FR-010**: Cancel during plan generation MUST propagate AbortSignal. The classifier and planner turns MUST observe the abort signal and reject immediately.
- **FR-011**: When plan mode is ON, system MUST NOT generate a task list. The existing markdown plan flow runs unchanged.
- **FR-012**: UI MUST render the task list as a sticky card between the chat messages list and the composer. The card MUST render only when `state.activeRun.tasks` is non-empty; otherwise the existing single-label progress UI is shown.
- **FR-013**: UI MUST default to expanded state. A click on the checklist header chevron MUST toggle between expanded and collapsed. Collapsed state MUST show `<status icon> N/total: <active task title>` for active runs and `<terminal icon> Completed N of total tasks` (or equivalent for other terminals) for closed runs.
- **FR-014**: Each task row MUST render a status icon (○ pending, ◐ in-progress with spinner animation, ⏸ paused, ✓ completed) and the task title. The animation MUST stop when `state.activeRun` is null (run closed).
- **FR-015**: ARIA semantics MUST include `role="list"` on the container, `role="listitem"` on rows, `aria-busy="true"` on the in-progress task, `aria-expanded` and `aria-controls` on the header button, and a polite `aria-live` region announcing the active task. UI text in the section MUST be English regardless of task title language.
- **FR-016**: Stream archive replay MUST reproduce `plan.created` and the full task transition sequence in order, so a reload mid-run returns the same task statuses as the live channel had emitted.
- **FR-017**: System MUST NOT backfill task lists for completed runs persisted before this feature deployed. Old runs render with the existing single-label UI.

### Key Entities

- **AgentRunProgressTimelineEvent (extended)**: existing discriminated union extended with two new variants: `task_plan` (carrying the full task list) and `task_transition` (carrying `id` + `transition`). The `task_transition` form persists transitions, not states, so replay reproduces stream events 1:1.
- **BuilderRunHandle (extended)**: existing in-memory run handle extended with `taskList: Array<{ id; title; phase }> | null` and `taskStatuses: Record<string, TaskStatus>`. Cleared on run terminal status via existing `clearTerminatedRuns` lifecycle.
- **RunStreamEvent (extended)**: existing union extended with `plan.created`, `plan.task.started`, `plan.task.completed`, `plan.task.paused`, `plan.task.resumed`.
- **PlanGenerationResult**: pure helper return value carrying `tasks` (or null) consumed by drivers and the translator.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For complex runs, a checklist with 2-8 task rows is visible in the chat panel within 10 seconds of prompt submit. Verified end-to-end on local dev with at least three different prompt shapes (init, multi-step update, new-route).
- **SC-002**: For simple runs, no checklist is rendered, no `plan.created` event is emitted, and wall-clock from prompt submit to first progress signal is within 1.25× the equivalent measurement on the previous build (no plan-feature regression on simple-prompt latency).
- **SC-003**: Privacy filter rejects 100% of test cases where a task title contains a file path, framework name, or code identifier (no leakage to the user-visible chat surface).
- **SC-004**: When the run reaches `done`, every task in the rendered checklist shows the completed icon. When `failed` or `cancelled`, no task animation continues. When `interrupted` (server restart), tasks display their last persisted status.
- **SC-005**: With plan mode ON, classifier and planner are not invoked for any chat turn. Verified by absence of `plan_classifier_decision` log events and `plan.created` events on plan-mode runs.
- **SC-006**: When a Vietnamese prompt is submitted to a complex run, every task title in the rendered checklist is Vietnamese (no English drift). Same for English. Same fallback to English when classifier returns invalid language.
- **SC-007**: Reloading the tab mid-run restores the checklist to the same task statuses as the live channel had emitted, accounting for the publish-first trade-off (last unpersisted transition may be missing on reload).

## Constitution Alignment

- **Principle I (Yêu cầu rõ ràng)**: Feature scope is bounded; no new infra introduced. Reuses `progressTimeline` persistence, codex SDK turns, chat-event-channel, existing reducer pattern.
- **Principle II (Test cho mọi business rule)**: Vitest coverage required for classifier, planner, translator, reducer (4 unit suites) plus 1 integration end-to-end. Privacy filter coverage required.
- **Principle III (API trả lỗi nhất quán)**: New SSE event types follow existing `RunStreamEvent` shape; classifier/planner failure surfaces via existing error logging — no new HTTP error contracts.
- **Principle IV (Không over-engineer)**: Lenient fallback (skip plan, no fail run) keeps the feature decorative. No retry classes, no new persistence column. Re-uses existing `progressTimeline` JSON column.
- **Principle V (UX & DESIGN.md)**: Single sticky card. Status icons drawn from existing icon vocabulary. No hard-coded colors. Validation client-side (collapse state) + server-side (privacy filter, JSON shape).
- **Principle VI (Bảo mật)**: No new endpoints. Existing `requireServerUser` continues to gate the SSE stream.
- **Principle IX (JSON Type Convention)**: New `progressTimeline` variants extend the existing `json()` column — no `jsonb()` introduced.
- **Principle X (Import Alias)**: All new modules import via `@/...` aliases.
