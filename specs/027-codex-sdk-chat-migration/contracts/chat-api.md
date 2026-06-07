# Contract — Chat HTTP + SSE API

**Date**: 2026-06-07 · **Plan**: [../plan.md](../plan.md)

This contract defines the request/response and SSE event shapes that the project-detail chat depends on. **Phase 1** keeps the existing `/runs` contract working transparently. **Phase 2** retires `/runs` and standardizes on `/builder-runs`.

---

## Phase 1 — Compatibility contract (legacy `/runs` route, codex-driven internally)

The existing endpoints under `/api/projects/$projectId/runs[/...]` keep their shape. Only the internal producer changes. Any client behavior change must be a strict superset (no field removed, no semantics narrowed).

### `POST /api/projects/$projectId/runs`

Request body:

```json
{
  "content": "Thêm image vào hero",
  "reasoningEffort": "medium",
  "planMode": false
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `content` | string | yes | non-empty after trim |
| `reasoningEffort` | `"low" \| "medium" \| "high" \| "xhigh"` | no | server defaults to project default |
| `planMode` | boolean | no | default `false` |

Server flow (Phase 1):

1. `requireServerUser`.
2. `MessageService.createRun` persists the user message, creates the `agent_runs` row, sets project `processing`, reserves the producer.
3. `driveRun` invokes the codex builder driver per R5 classification (`init` / `update` / `new_route`).
4. The driver's `BuilderRunEvent` stream is translated into the existing `RunStreamEvent` shape inside `MessageService.runOrchestrator` per R8.

Response body (HTTP 201):

```json
{
  "runId": "<uuid>",
  "userMessage": { "id": "<uuid>", "...": "..." },
  "project": { "id": "<uuid>", "processingStatus": "processing", "activeRunId": "<uuid>" },
  "stream": { "url": "/api/projects/<uuid>/runs/<runId>/stream" }
}
```

Errors (status, code):

- 400 `PROMPT_EMPTY` — empty content after trim.
- 404 `PROJECT_NOT_FOUND` — project missing or not owned by the user.
- 409 `PROJECT_ALREADY_PROCESSING` — another run is in flight.
- 500 `PROVIDER_STREAM_FAILED` — codex driver failed to start.

### `GET /api/projects/$projectId/runs/$runId/stream` (SSE)

Existing event types remain valid:

- `run.started`
- `message.created` (with `kind` ∈ `plan` / `answer` / `clarification` / `error` / `review_required` / `agent_question`)
- `message.delta` (β-lite chunks)
- `message.completed`
- `skeleton.update` (phase + label + detail; new path emits these from `phaseLabel`/`fileChangeToSection`)
- `run.awaiting_input`
- `option.selected`
- `run.completed`
- `run.failed`
- `run.stopped`
- `heartbeat`

The translator MUST never emit a `RunStreamEvent` whose user-visible text contains a file path, code identifier, or framework token (FR-007).

### `POST /api/projects/$projectId/runs/$runId/select-option`

Body:

```json
{ "optionId": "variant-2" }
```

Or:

```json
{ "freeText": "Tôi muốn warm retail style" }
```

Server semantics: forwarded to the underlying `BuilderRunHandle.resumeFn` (skill clarification or design variant). On success, returns 204; on invalid state, 409 `RUN_NOT_AWAITING_INPUT`.

### `POST /api/projects/$projectId/runs/$runId/stop`

204 on success; 409 `STOP_NOT_ALLOWED` if the run is already terminal.

### `POST /api/projects/$projectId/runs/$runId/retry`

201 with the same shape as `POST /runs/`. Reuses the original run's `reasoningEffort` unless the body overrides it.

---

## Phase 2 — Standardized contract (`/builder-runs`)

After Phase 2, the chat UI POSTs to `/api/projects/$projectId/builder-runs` and subscribes to `/api/projects/$projectId/builder-runs/$runId/stream`. The `/runs` tree is removed in Phase 5.

### `POST /api/projects/$projectId/builder-runs`

Request body:

```json
{
  "prompt": "Thêm image vào hero",
  "reasoningEffort": "medium",
  "planMode": false,
  "locale": "vi-VN"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `prompt` | string | yes | non-empty after trim |
| `reasoningEffort` | `"low" \| "medium" \| "high" \| "xhigh"` | no | persisted on `agent_runs.reasoningEffort` |
| `planMode` | boolean | no | when true, server runs the plan turn (R2) before any execute turn |
| `locale` | string | no | defaults to `"vi-VN"` |

`kind` is intentionally NOT accepted from the client (R5). Server resolves:

1. If `project.status === "draft"` OR workspace empty → `kind = "init"`.
2. Else `classifyUpdatePrompt` → `update` / `new_route`; `unsupported` → 400 `blocked_request`.

Response body (HTTP 201):

```json
{
  "ok": true,
  "runId": "<uuid>",
  "userMessage": { "id": "<uuid>", "...": "..." },
  "project": { "id": "<uuid>", "processingStatus": "processing", "activeRunId": "<uuid>" },
  "stream": { "url": "/api/projects/<uuid>/builder-runs/<runId>/stream" }
}
```

The endpoint persists the user `Message` and `agent_runs` row (replicating `MessageService.createRun` semantics) so chat history survives without going through the legacy service.

Errors:

- 400 `blocked_request` — empty prompt or `unsupported` classifier verdict.
- 404 `PROJECT_NOT_FOUND`.
- 409 `active_run_exists` — another run already in flight (existing `ActiveRunExistsError`).
- 503 `config_unavailable` — codex env not available.

### `GET /api/projects/$projectId/builder-runs/$runId/stream` (SSE)

Each event is a `BuilderRunEvent` extended with chat-message events that mirror what the legacy SSE shipped. The full event vocabulary:

- `run.started` → `{ type: "run.started", runId, projectId }`
- `milestone` → existing codex builder milestone (translated via `phaseLabel` for UI)
- `skeleton.update` → page/section progress text (γ + α path)
- `message.created` → chat message envelope (β-lite answer, plan markdown, clarification stub, error)
- `message.delta` → β-lite delta chunks
- `message.completed` → terminal text for the message
- `awaiting_clarification` → existing event with extended `metadata` (see `progress-events.md`)
- `done` → terminal success
- `failed` → terminal failure with `failureCode`
- `cancelled` → cancellation
- `heartbeat` → keep-alive every 15s

Replay semantics: the SSE handler replays buffered events from the in-memory `BuilderRunHandle.events` AND the persisted `progressTimeline` so a reload during a run restores progress. Beyond terminal, the timeline is sweep-evicted after 24h.

### `POST /api/projects/$projectId/builder-runs/$runId/answer`

Body (mutually exclusive fields):

```json
{ "optionId": "variant-2" }
```

```json
{ "freeText": "Tôi muốn warm retail style" }
```

Plan-mode approval/rejection:

```json
{ "planAction": "approve" }
```

```json
{ "planAction": "reject" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `optionId` | string | one-of | matches an `id` from the active clarification |
| `freeText` | string | one-of | non-empty after trim; only allowed when `customAnswerAllowed` |
| `planAction` | `"approve" \| "reject"` | one-of | only valid when `planPhase.stage === "plan_ready"` |

204 on success. 409 `RUN_NOT_AWAITING_INPUT` if state mismatched. 400 `INVALID_OPTION` if the option is not in the active set.

### `POST /api/projects/$projectId/builder-runs/$runId/cancel`

204 on success; 409 `STOP_NOT_ALLOWED` if terminal.

### `POST /api/projects/$projectId/builder-runs/$runId/retry`

201 with the same shape as `POST /builder-runs`. Reuses `reasoningEffort` and `planMode` from the original `agent_runs` row unless overridden in body.

---

## Cross-cutting

### Authentication

Every endpoint runs `requireServerUser`. Run handles record `userId` and reject foreign access with 403 `forbidden`.

### Privacy guarantees

- Every chat event with user-visible text passes through the privacy filter (`progress-mapper.server.ts`).
- The privacy filter is a **defence-in-depth** layer; the prompt and γ mapping are the primary controls.
- A unit test asserts that a corpus of synthetic events containing file paths is rejected/rewritten before SSE emission.

### Idempotency

`POST /builder-runs` is NOT idempotent. Submitting the same prompt twice creates two runs unless one is already active (409). Clients should rely on the optimistic-message + `runId` flow.
