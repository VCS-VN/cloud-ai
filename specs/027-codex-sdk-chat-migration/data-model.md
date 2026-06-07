# Phase 1 Data Model — Codex SDK Chat Migration

**Date**: 2026-06-07
**Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

This document captures all entities, relationships, validation rules, and state transitions touched by this migration. It is **additive** — no destructive schema migration on existing tables.

---

## Conventions

- Drizzle ORM 0.45.2 with PostgreSQL.
- All JSON columns use `json()`, never `jsonb()` (Constitution IX).
- Persistence is restart-safe per FR-023..FR-025 (`research.md` R4).
- Field names use `snake_case` in the DB layer and the matching `camelCase` accessor in TypeScript types under `src/shared/project-types.ts`.

---

## 1. Project (existing — no change)

Already defined; reused as the source of truth for `kind=init` detection (R5).

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `userId` | `uuid` (nullable) | owner |
| `status` | enum (`draft` / `generating` / `ready` / `failed`) | drives init detection |
| `processingStatus` | enum (`idle` / `processing`) | run guard |
| `activeRunId` | `uuid` (nullable) | currently driving run; used for resume |

**Migration impact**: None. Read-only for this feature.

---

## 2. Message (existing — additive metadata only)

Existing `messages` table backs the chat history. The migration adds **two new `kind` values** and extends the JSON `metadata` column to carry plan-mode and design-variant payloads. No column type change.

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `userId` | `uuid` (nullable) | inherited from project owner |
| `projectId` | `uuid` | FK |
| `role` | enum (`user` / `agent`) | unchanged |
| `content` | `text` | β-lite summary text for `kind: "answer"`, plan markdown for `kind: "plan"`, friendly error for `kind: "error"` |
| `status` | enum | unchanged |
| `processingStatus` | enum (`pending` / `streaming` / `completed` / `failed` / `stopped`) | unchanged |
| `parentMessageId` | `uuid` (nullable) | links agent message to user prompt |
| `runId` | `uuid` (nullable) | FK to `agent_runs.id` |
| `kind` | enum | EXPANDED: `plan` / `answer` / `clarification` / `error` / `review_required` / `agent_question` |
| `metadata` | `json` (nullable) | discriminated union by `questionType` (see §6) or plan payload (see §7) |
| `provider` | `text` (nullable) | set to `"codex-sdk"` for new path |
| `errorMessage` | `text` (nullable) | unchanged |
| `startedAt` / `completedAt` / `updatedAt` / `createdAt` | timestamptz | unchanged |

### Validation rules

- `kind = "plan"` MUST have `metadata.planPhase = "plan_ready" | "plan_rejected"` and `content` containing the rendered plan markdown.
- `kind = "answer"` β-lite MUST contain at most one paragraph (≤ ~400 chars) and pass the privacy filter (R6).
- `kind = "agent_question"` with `questionType = "design_variant"` MUST carry exactly four options.
- `kind = "agent_question"` with `questionType = "skill_clarification"` MUST carry at least one option.

---

## 3. AgentRun (existing — additive columns)

Existing table referenced by `src/server/repositories/agent-run-repository.ts`. The migration **adds three** `json()` columns (R4).

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `projectId` | `uuid` | FK |
| `userId` | `uuid` (nullable) | inherited |
| `parentMessageId` | `uuid` (nullable) | the user prompt that started this run |
| `userPrompt` | `text` | unchanged |
| `reasoningEffort` | enum (`low` / `medium` / `high` / `xhigh`, nullable) | unchanged; persisted per run for retry default |
| `planMode` | `boolean` | unchanged; controls Phase 3 routing |
| `kind` | enum (`init` / `update` / `new_route`) | NEW (additive); resolved server-side per R5 |
| `status` | enum (`queued` / `streaming` / `awaiting_clarification` / `completed` / `failed` / `cancelled` / `interrupted`) | EXPANDED: `interrupted` is new |
| `failureCode` | enum (nullable) | EXPANDED with `interrupted_by_restart` |
| `progressTimeline` | `json` (nullable) | NEW (additive) — capped append-only list of `{ at, kind, payload }` (see §4) |
| `planPhase` | `json` (nullable) | NEW (additive) — `null` or plan-mode state (see §7) |
| `clarificationSnapshot` | `json` (nullable) | NEW (additive) — `null` or last awaiting-clarification payload (see §6) |
| `startedAt` / `completedAt` | timestamptz | unchanged |

### State transitions

```text
queued → streaming → completed
                  ↘ failed
                  ↘ cancelled
                  ↘ awaiting_clarification → streaming → completed/failed
                  ↘ interrupted   (set on boot scan when row was streaming with no live handle)
```

### Validation rules

- `progressTimeline` length ≤ 200 events; older events are dropped (FIFO) when capped.
- When `status = "awaiting_clarification"`, `clarificationSnapshot` MUST be non-null.
- When `planMode = true`, the run MUST traverse `planPhase = "plan_pending"` → `"plan_ready"` before any execute turn; `planPhase = "executing"` requires an explicit Approve.
- On boot scan: any row with `status = "streaming"` and no handle is moved to `failed` with `failureCode = "interrupted_by_restart"`. Rows with `status = "awaiting_clarification"` and a recoverable `clarificationSnapshot` stay `awaiting_clarification` and a fresh handle is rebuilt for resume.

---

## 4. ProgressTimelineEvent (new value type, persisted in `agent_runs.progressTimeline`)

```ts
type ProgressTimelineEvent =
  | { at: number; kind: "milestone"; milestone: BuilderRunMilestone }
  | { at: number; kind: "section"; section: string; locale: "vi" | "en" }
  | { at: number; kind: "summary"; text: string }
  | { at: number; kind: "error"; failureCode: BuilderRunFailureCode };
```

### Validation rules

- `section.text` and `summary.text` MUST pass the privacy filter (R6) before insert.
- `at` is `Date.now()` at emission time; events are append-only.

### Lifetime

Transient by spec; persisted only to support reconnect-during-run (D'). After run terminal, the timeline is retained for 24 h then truncated by a sweep job.

---

## 5. DesignVariant (existing entity, retail-vibe constrained)

```ts
type DesignVariant = {
  id: string;            // stable per-run, e.g. "variant-1"
  label: string;         // short retail-vibe name, ≤ 30 chars
  description: string;   // one-line user-facing copy, ≤ 120 chars, privacy-filtered
  preview: {
    font: string;        // CSS font-family value or token name
    palette: string[];   // 3..5 hex colors for the palette dots
    motion: number;      // 0..1 motion intensity hint
    density?: number;    // optional density hint
  };
};
```

### Validation rules

- Exactly four variants per init clarification (FR-018).
- Each variant's `description` MUST contain no file paths, code identifiers, or framework names.
- `palette` length ∈ [3, 5]; each entry is a 6- or 8-digit hex prefixed by `#`.
- `id` is unique within the clarification payload; selection records the chosen `id` on `agent_runs.clarificationSnapshot`.

---

## 6. ClarificationSnapshot (new value type, persisted in `agent_runs.clarificationSnapshot`)

```ts
type ClarificationSnapshot =
  | {
      questionType: "design_variant";
      options: DesignVariant[];        // exactly 4
      selectedOptionId: string | null;
      customAnswerAllowed: true;
      originalRunPrompt: string;
    }
  | {
      questionType: "skill_clarification";
      options: { id: string; label: string }[];
      selectedOptionId: string | null;
      customAnswerAllowed: boolean;
      originalRunPrompt: string;
    };
```

### Validation rules

- `originalRunPrompt` is the user's ORIGINAL prompt (not the clarification follow-up); used to reconstruct execute-turn input on Approve.
- `selectedOptionId` is `null` while the run is `awaiting_clarification`; set when the user answers via `/builder-runs/$runId/answer`.
- `customAnswerAllowed = false` for `skill_clarification` unless explicitly allowed by the skill registry.

---

## 7. PlanPhase (new value type, persisted in `agent_runs.planPhase`)

```ts
type PlanPhase =
  | { stage: "plan_pending" }
  | {
      stage: "plan_ready";
      planMarkdown: string;            // exact markdown from the plan turn
      planTurnDoneAt: number;          // ms epoch
      planThreadId: string;            // codex thread id of the plan turn (for audit)
    }
  | {
      stage: "plan_rejected";
      planMarkdown: string;
      rejectedAt: number;
    }
  | {
      stage: "executing";
      planMarkdown: string;
      executeThreadId: string;         // codex thread id of the execute turn (separate thread per R2)
      approvedAt: number;
    };
```

### Validation rules

- Stage transitions: `plan_pending` → `plan_ready` → (`plan_rejected` | `executing`).
- `executing` requires that an `Approve` action was recorded (FR-015). Server enforces by refusing to start the execute thread if `planPhase.stage !== "plan_ready"` at approve time.
- Workspace diff between `plan_pending` and `plan_ready` MUST be empty (SC-006); audited by a workspace-snapshot check around the plan turn.

---

## 8. BuilderRunHandle (in-memory mirror)

`BuilderRunHandle` keeps the existing in-memory shape but every mutation is mirrored to `agent_runs`. The handle adds:

```ts
{
  // ...existing
  reasoningEffort: ComposerReasoningEffort | null;  // (R1)
  planPhase: PlanPhase | null;                      // (§7)
  progressTimeline: ProgressTimelineEvent[];         // (§4)
}
```

### Lifetime

Created on builder run start, kept until terminal + 5 minutes (existing `clearTerminatedRuns`), then evicted. On boot, missing handles for streaming rows trigger R4 cleanup.

---

## 9. Relationships

```text
Project 1 ── n AgentRun
AgentRun 1 ── n Message  (parentMessageId chain: user prompt → agent answer / plan / clarification / error)
AgentRun 1 ── 1 BuilderRunHandle (transient mirror in memory; restored on boot)
AgentRun.clarificationSnapshot ↔ Message(kind="agent_question").metadata  (same payload during await)
AgentRun.planPhase ↔ Message(kind="plan").metadata                         (same plan markdown surfaced)
```

---

## 10. Backward-compatibility notes

- Old `messages` rows from the legacy ai-agent path retain their content unchanged; they are read-only history. The new path produces messages with `provider = "codex-sdk"` so audits can distinguish.
- `agent_runs` rows from the legacy path may have `kind = NULL`; the migration sets a default of `"update"` for legacy rows during the additive migration to keep queries simple. (Optional — drop if not needed during cleanup.)
- Phase 5 cleanup deletes legacy code but does NOT delete legacy rows.
