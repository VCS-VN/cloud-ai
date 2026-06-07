# Contract: POST /api/projects/:projectId/builder-runs/:runId/answer

**Status**: NEW endpoint (Phase 2). Resumes a builder run that paused with milestone `awaiting_clarification` after the user answers the clarification question.

## Description

The skill detector pauses a builder run with milestone `awaiting_clarification` whenever:
1. Two candidates fall in the 50–79 score band with a gap ≤ `LLM_TIE_BREAK_GAP` and the LLM tie-break either failed or returned an ambiguous response, OR
2. A selected skill declares `clarificationPolicy: always_before_apply`.

While the run is paused, no draft workspace exists on disk and no Codex thread has been started. The run survives in the in-memory builder-run registry and the `builder_runs` row carries `pendingSkills[]` populated.

The user submits an answer to this endpoint. The detector re-runs with `originalPrompt + answer + pendingSkills metadata`. If the rerun yields a confident pick, the run resumes from `loading_context` and proceeds to `creating_draft` and beyond.

## Request

```
POST /api/projects/:projectId/builder-runs/:runId/answer
Content-Type: application/json

{
  "optionId"?: string,
  "freeText"?: string
}
```

### Path parameters

| Param | Type | Notes |
|---|---|---|
| `projectId` | string | The project owning the run. |
| `runId` | string | The run that is paused in `awaiting_clarification`. |

### Body

Exactly one of `optionId` or `freeText` MUST be present and non-empty (after trim).

| Field | Type | Notes |
|---|---|---|
| `optionId` | string | The id of one of the bounded options surfaced in the SSE clarification event. |
| `freeText` | string | Free-form user answer when none of the options fit. Min 1 character after trim. |

### Auth

Same auth model as Phase 1 builder-runs endpoints: requires session, owner of the run must match the authenticated user.

## Response — Success

```
HTTP 200
Content-Type: application/json

{ "ok": true }
```

The run transitions back to `loading_context` and continues. SSE subscribers see milestone events resume in normal order. Subsequent state ends in `done` / `failed` / `cancelled` per Phase 1 semantics.

## Response — Errors

All errors follow Phase 1 Constitution III shape: `{ ok: false, code, message }` with appropriate HTTP status.

### `404 not_found`

```
{ "ok": false, "code": "not_found", "message": "Run not found." }
```

The runId does not match any in-memory or persisted run for this project.

### `403 forbidden`

```
{ "ok": false, "code": "forbidden", "message": "Forbidden." }
```

The authenticated user does not own the run.

### `409 not_paused`

```
{ "ok": false, "code": "not_paused", "message": "Run is not awaiting clarification." }
```

The run exists but its current status is not `awaiting_clarification`. Common causes: the run already resumed via a prior call, or the run terminated (done/failed/cancelled).

### `400 empty_answer`

```
{ "ok": false, "code": "empty_answer", "message": "Answer cannot be empty." }
```

Both `optionId` and `freeText` are missing or empty after trim.

### `400 invalid_option`

```
{ "ok": false, "code": "invalid_option", "message": "Selected option is not valid for this run." }
```

`optionId` does not match any option in the run's currently-active clarification prompt.

### `500 detector_failed`

```
{ "ok": false, "code": "detector_failed", "message": "Could not resume run." }
```

The detector rerun threw unexpectedly. Run remains paused; user can retry the answer.

## Side effects

- On success: `builder_runs.pendingSkills` is rewritten to `[]`, `selectedSkills` is populated with the rerun's pick. SSE emits the next milestone event (`creating_draft` or, if the rerun re-paused, another `awaiting_clarification`).
- On error: no run state mutation. The caller may retry.

## Sequence

```
Client                 Builder API              Builder Runtime
  │                         │                         │
  │── POST /answer  ──────► │                         │
  │  {optionId|freeText}    │── validate auth ──────► │
  │                         │── load handle ────────► │
  │                         │── reject if !paused     │
  │                         │── rerun detector ─────► │ rerun selection
  │                         │                         │   ├─ picked → continue run
  │                         │                         │   └─ still pending → keep paused
  │                         │── update DB ──────────► │
  │ ◄─ 200 / 409 / 400 ─────│                         │
  │                         │                         │
  │ (separate SSE)          │── publish event ──────► │ awaiting_clarification(again) | creating_draft
```

## Notes

- This endpoint is the only path to resume a paused run. There is no auto-resume on timeout in Phase 2 — paused runs are GC'd after 12h via the existing retention scheduler with `reason: "cancelled"` if the user never answers.
- The endpoint is idempotent for `409 not_paused`: a second call to a run that already resumed returns the same `not_paused` error rather than mutating state.
