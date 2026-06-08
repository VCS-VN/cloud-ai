# Data Model: Plan Task Checklist

**Feature**: `028-plan-task-checklist` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

This document captures every data shape that this feature touches: schema additions to the `progress_timeline` JSON column, new in-memory state on the run handle, new SSE event types, and the LLM I/O contracts for the classifier and planner.

---

## 1. Persistence — `agent_runs.progress_timeline` (existing JSON column)

### 1.1 Existing variants (unchanged)

```ts
type AgentRunProgressTimelineEvent =
  | { at: number; kind: "milestone"; milestone: string }
  | { at: number; kind: "section"; section: string; locale: "vi" | "en" }
  | { at: number; kind: "summary"; text: string }
  | { at: number; kind: "error"; failureCode: AgentRunFailureCode };
```

### 1.2 New variants (added)

```ts
type AgentRunProgressTimelineEvent =
  | /* existing variants ... */
  | {
      at: number;
      kind: "task_plan";
      tasks: Array<{
        id: string;     // unique within array
        title: string;  // ≤ 80 chars; LLM-generated in user language
        phase: "prep" | "build" | "verify";
      }>;
    }
  | {
      at: number;
      kind: "task_transition";
      id: string;       // task id
      transition: "started" | "completed" | "paused" | "resumed";
    };
```

**Rationale**: Persisting *transitions* rather than terminal states preserves the live event sequence so the archive replay is 1:1 with the live SSE stream. The reducer reconstructs the current task status by replaying the transition list.

### 1.3 Persistence cap

`MAX_PROGRESS_TIMELINE_EVENTS = 200` (existing). One run produces:
- 1 `task_plan` event
- 2 transitions per task (start, complete) = 4-16 transitions
- Up to 2 transitions per pause cycle (pause, resume) — bounded by clarification count

Worst-case run: ~25 task-related events. Far below cap.

### 1.4 Migration

No SQL migration required. The existing `progress_timeline` column is `json("progress_timeline").notNull().default([])` (per Constitution IX). The discriminated union widens at the TypeScript layer only.

---

## 2. In-memory — `BuilderRunHandle` (existing registry)

### 2.1 Existing fields (unchanged)

```ts
type BuilderRunHandle = {
  runId: string;
  projectId: string;
  userId: string | undefined;
  status: BuilderRunStatus;
  abortController: AbortController;
  events: BuilderRunEvent[];
  subscribers: Set<(event: BuilderRunEvent) => void>;
  startedAt: number;
  completedAt?: number;
  pendingSkills: SelectionPending[];
  clarificationPrompt: { question: string; options: BuilderRunClarificationOption[] } | null;
  userPrompt: string | null;
  resumeFn: ((answer: { optionId?: string; freeText?: string; planAction?: "approve" | "reject" }) => Promise<void>) | null;
  loadedSkills: { name: string; at: number }[];
};
```

### 2.2 New fields (added)

```ts
type TaskStatus = "pending" | "active" | "paused" | "done";

type BuilderRunHandle = {
  /* existing fields ... */
  taskList: Array<{
    id: string;
    title: string;
    phase: "prep" | "build" | "verify";
  }> | null;
  taskStatuses: Record<string, TaskStatus>;
};
```

**Initialization** (`createBuilderRunHandle`):

```ts
{
  /* existing ... */
  taskList: null,
  taskStatuses: {},
}
```

**Lifecycle**: Cleared by existing `clearTerminatedRuns(maxAgeMs)` mechanism. No new cleanup code needed.

**Mutation entry points** (3 only):
1. `runPlanGenerationPhase` — sets `taskList` + initializes `taskStatuses` to all-pending after planner success.
2. `fireTaskTransitions(handle, emit, milestone)` — flips statuses on bucket transitions.
3. `fireTaskPauseAll` / `fireTaskResumeAll` — flips active↔paused on awaiting_clarification ↔ resume.

---

## 3. Stream events — `RunStreamEvent` (existing union)

### 3.1 New variants

```ts
type RunStreamEvent =
  | /* existing variants ... */
  | {
      type: "plan.created";
      runId: string;
      tasks: Array<{ id: string; title: string; phase: "prep" | "build" | "verify" }>;
      at: number;
    }
  | { type: "plan.task.started"; runId: string; taskId: string; at: number }
  | { type: "plan.task.completed"; runId: string; taskId: string; at: number }
  | { type: "plan.task.paused"; runId: string; taskId: string; at: number }
  | { type: "plan.task.resumed"; runId: string; taskId: string; at: number };
```

### 3.2 Bridge translation — `BuilderRunEvent` → `RunStreamEvent`

Driver fires `BuilderRunEvent` task transitions; translator passes them through 1:1 with re-shape.

```ts
// New BuilderRunEvent variants (driver-side):
type BuilderRunEvent =
  | /* existing variants ... */
  | { type: "plan.created"; runId: string; tasks: Array<...>; at: number }
  | { type: "plan.task.started" | "plan.task.completed" | "plan.task.paused" | "plan.task.resumed"; runId: string; taskId: string; at: number };
```

Translator output (`builder-run-translator.server.ts`):
- `plan.created` → emits identical `RunStreamEvent` + persists `task_plan` to progressTimeline.
- `plan.task.<transition>` → emits identical `RunStreamEvent` + persists `task_transition` to progressTimeline.

### 3.3 Ordering (publish-first, documented trade-off)

Per FR-006, `publishBuilderRunEvent` runs **before** `appendProgressTimelineEvent`. A crash between publish and persist leaves the live FE with a transition the archive replay won't reproduce. This is accepted in exchange for lower live-feedback latency.

---

## 4. LLM I/O — Classifier

### 4.1 Input

```ts
type ClassifierInput = {
  prompt: string;          // user's prompt
  signal?: AbortSignal;
  env: CodexEnvAvailable;
  draftWorkspacePath: string;
};
```

### 4.2 Codex thread config

- `sandboxMode: "read-only"`
- `modelReasoningEffort: "minimal"`
- `model`: same as main `CODEX_MODEL` env

### 4.3 Output schema

```ts
type ClassifierOutput = {
  complexity: "simple" | "complex";
  language: string;  // ISO-639-1 code, lowercase, 2 chars
};
```

### 4.4 Validation + fallback

```ts
const ClassifierOutputSchema = z.object({
  complexity: z.enum(["simple", "complex"]),
  language: z.string().regex(/^[a-z]{2}$/).default("en"),
});
```

If parsing fails after retry budget exhausted (existing `BoundedCodexThread.runTurn` retry logic):
- Log `plan_classifier_failed_fallback`
- Return `{ complexity: "complex", language: "en" }` (defaults to complex per FR-002, language fallback EN per FR-004)

### 4.5 Init bypass

`ctx.kind === "init"` skips the classifier entirely. Returns `{ complexity: "complex", language: "en" }` immediately.

---

## 5. LLM I/O — Planner

### 5.1 Input

```ts
type PlannerInput = {
  prompt: string;          // user's prompt + (init: variant context)
  language: string;        // from classifier
  signal?: AbortSignal;
  env: CodexEnvAvailable;
  draftWorkspacePath: string;
};
```

### 5.2 Codex thread config

- `sandboxMode: "read-only"`
- `modelReasoningEffort: "minimal"`
- `model`: same as main env

### 5.3 Output schema

```ts
type PlannerOutput = {
  tasks: Array<{
    id: string;     // unique within array
    title: string;  // ≤ 80 chars
    phase: "prep" | "build" | "verify";
  }>;
};
```

### 5.4 Validation rules

```ts
const TaskSchema = z.object({
  id: z.string().min(1).max(64),
  title: z
    .string()
    .min(1)
    .max(80)
    .refine(isPrivacySafe, { message: "title must be privacy-safe" }),
  phase: z.enum(["prep", "build", "verify"]),
});

const PlannerOutputSchema = z.object({
  tasks: z
    .array(TaskSchema)
    .min(2)
    .max(8)
    .superRefine((arr, ctx) => {
      const ids = new Set<string>();
      for (const t of arr) {
        if (ids.has(t.id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate task id" });
        }
        ids.add(t.id);
      }
    }),
});
```

### 5.5 Retry + fallback

- 1 validation retry (matches `generateRetailVariants` pattern).
- After both attempts fail → return `{ ok: false, reason }`. Driver silently falls back to single-label UI per FR-009.

### 5.6 Privacy filter

`isPrivacySafe` (existing in `progress-mapper.server.ts`) rejects strings containing:
- File extensions (`.tsx`, `.ts`, `.css`, etc.)
- Path segments (e.g., `src/`, `routes/`)
- Framework tokens (`Vite`, `React`, `TanStack`, `tailwind`)
- Code identifiers (camelCase or PascalCase keywords)

### 5.7 Phase distribution (soft constraint)

Prompt instructs the planner: *"When possible, distribute tasks across phases. For trivial requests, you may skew toward 'build' only."*

Validator does NOT enforce ≥1 task per phase. Distribution is logged for observability:

```ts
{ event: "plan_phase_distribution", prep: number, build: number, verify: number }
```

---

## 6. UI state — `ChatUIState.activeRun` (extended)

### 6.1 Existing `RunUIState`

```ts
type RunUIState = {
  runId: string;
  status: "streaming" | "awaiting_input" | "stopping";
  skeleton: { phase: SkeletonPhase; label: string; detail?: string } | null;
};
```

### 6.2 Extended `RunUIState`

```ts
type RunUIState = {
  runId: string;
  status: "streaming" | "awaiting_input" | "stopping";
  skeleton: { phase: SkeletonPhase; label: string; detail?: string } | null;
  tasks: Array<{ id: string; title: string; phase: "prep" | "build" | "verify" }> | null;
  taskStatuses: Record<string, "pending" | "active" | "paused" | "done">;
};
```

### 6.3 Reducer transitions (`chatStateReducer`)

| Event type | State change |
|---|---|
| `plan.created` | `tasks = event.tasks`; `taskStatuses = Object.fromEntries(tasks.map(t => [t.id, "pending"]))` |
| `plan.task.started` | `taskStatuses[event.taskId] = "active"` |
| `plan.task.completed` | `taskStatuses[event.taskId] = "done"` |
| `plan.task.paused` | `taskStatuses[event.taskId] = "paused"` |
| `plan.task.resumed` | `taskStatuses[event.taskId] = "active"` |
| `run.completed` / `run.failed` / `run.stopped` | `activeRun = null` (existing behavior; tasks cleared with run) |

Local component state (`PlanChecklist.tsx`) holds `expanded: boolean` separately (UI-only).

---

## 7. Milestone → Phase bucket mapping

Used by `fireTaskTransitions` driver helper.

| BuilderRunMilestone | Bucket |
|---|---|
| `loading_context` | `prep` |
| `planning` | `prep` |
| `creating_draft` | `build` |
| `building_pages` | `build` |
| `checking_preview` | `verify` |
| `publishing` | `verify` |
| `repairing` | (none — no transition fired) |
| `awaiting_clarification` | (none — pause helper handles) |
| `done` / `failed` / `cancelled` | (none — terminal helper handles) |

**Bucket order**: `prep` → `build` → `verify`. When entering bucket *N*, all tasks in bucket *N-1* with status `active` flip to `done`, and all tasks in bucket *N* with status `pending` flip to `active`.

When run reaches `done`: all non-`done` tasks flush to `done`. When run reaches `failed` or `cancelled`: no flush; tasks remain at last status (UI handles the closed state).
