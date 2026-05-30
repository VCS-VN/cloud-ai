# HTTP Endpoints Contract: Multi-Message Agent Runs

**Feature**: [021-multi-message-agent-runs](../spec.md)
**Date**: 2026-05-29

Base path: `/api/projects/:projectId`. Tất cả endpoint yêu cầu authenticated user là owner của project (kiểm tra `userId` match). Lỗi auth trả `401` với code `UNAUTHENTICATED`; project không thuộc user trả `404` với code `PROJECT_NOT_FOUND` (không leak existence).

## Error response format (consistent — Constitution III)

```jsonc
// HTTP status code phù hợp + body:
{
  "error": {
    "code": "STREAM_ERROR_CODE",   // StreamErrorCode enum
    "message": "Human-friendly message"
  }
}
```

| Code | HTTP | Khi nào |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Chưa login |
| `PROJECT_NOT_FOUND` | 404 | Project không tồn tại / không thuộc user |
| `PROMPT_EMPTY` | 400 | content rỗng sau trim |
| `PROJECT_ALREADY_PROCESSING` | 409 | Project đang có run active khi tạo run mới |
| `RUN_NOT_FOUND` | 404 | runId không tồn tại |
| `RETRY_NOT_ALLOWED` | 409 | Retry run không ở status `failed` |
| `PROVIDER_NOT_CONFIGURED` | 503 | Agent orchestrator không khả dụng |

---

## POST `/api/projects/:projectId/runs`

Tạo run mới (gửi prompt). Khởi tạo user message + agent run + chuyển project sang processing.

**Request body**:
```jsonc
{
  "content": "string",                    // required, user prompt, non-empty sau trim
  "reasoningEffort": "low|medium|high|xhigh",  // optional
  "planMode": false                       // optional, default false
}
```

**Response 201**:
```jsonc
{
  "runId": "string",
  "userMessage": {
    "id": "string",
    "projectId": "string",
    "role": "user",
    "content": "string",
    "status": 1,
    "processingStatus": "completed",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
    // runId, kind = null/undefined cho user message
  },
  "streamUrl": "/api/projects/:projectId/runs/:runId/stream"
}
```

**Errors**: `PROMPT_EMPTY` (400), `PROJECT_ALREADY_PROCESSING` (409), `PROJECT_NOT_FOUND` (404).

**Side effects**:
- INSERT 1 `project_messages` (role=user).
- INSERT 1 `agent_runs` (status=streaming, reasoningEffort/planMode lưu vào row).
- UPDATE `projects` SET processing_status='processing', active_run_id=newRunId, processing_started_at=now.
- Đăng ký abort controller + event buffer cho runId trong memory.

**Note**: Endpoint KHÔNG block chờ agent chạy xong. Agent loop chạy async; client mở SSE qua `streamUrl` để nhận events. Agent orchestrator được kick off khi client connect stream (giống pattern hiện tại) HOẶC ngay sau POST (quyết định implementation — research recommends kick off khi stream connect để buffer events từ đầu).

---

## GET `/api/projects/:projectId/runs/:runId/stream`

SSE stream cho 1 run. Multi-subscriber (fan-out). Resume-able.

**Query params**: không (reasoningEffort/planMode đã lưu trên run row).

**Response**: `text/event-stream`. Xem [sse-events.md](./sse-events.md) cho event schema.

**Headers**:
```text
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

**Behavior**:
- Nếu run đang chạy: replay buffered events (từ đầu run đến hiện tại) rồi tiếp tục live.
- Nếu run đã terminal (completed/failed/stopped): emit terminal event tương ứng + đóng.
- Nếu runId không trong memory nhưng DB còn `processing` (stale): cleanup → mark messages failed, project idle, emit `run.failed` với code `RUN_INTERRUPTED`, đóng.
- Nếu runId không tồn tại: HTTP 404 `RUN_NOT_FOUND`.
- Multi-subscriber: nhiều client connect cùng runId đều nhận đủ events; subscriber disconnect KHÔNG abort run.
- Heartbeat mỗi 15s.

---

## POST `/api/projects/:projectId/runs/:runId/stop`

Stop run đang chạy. Idempotent.

**Request body**: rỗng `{}`.

**Response 200**:
```jsonc
{
  "runId": "string",
  "status": "stopped",            // hoặc status hiện tại nếu đã terminal (no-op)
  "projectProcessingStatus": "idle"
}
```

**Behavior**:
- Run đang chạy: abort controller → mark run status='stopped', answer message (nếu có) status='stopped' giữ partial content, project idle, emit `run.stopped` trên channel.
- Run đã terminal: no-op, trả 200 với status hiện tại.
- runId không tồn tại: 404 `RUN_NOT_FOUND`.

**Note**: Client gọi fire-and-forget (không await để revert UI). UI optimistic revert ngay.

---

## POST `/api/projects/:projectId/runs/:runId/retry`

Retry run đã failed. Tạo run mới với cùng prompt.

**Request body**:
```jsonc
{
  "reasoningEffort": "low|medium|high|xhigh",  // optional, default copy từ run cũ
  "planMode": false                            // optional, default copy từ run cũ
}
```

**Response 201**:
```jsonc
{
  "newRunId": "string",
  "streamUrl": "/api/projects/:projectId/runs/:newRunId/stream"
}
```

**Behavior**:
- Run cũ MUST ở status='failed', else 409 `RETRY_NOT_ALLOWED`.
- Project MUST idle, else 409 `PROJECT_ALREADY_PROCESSING`.
- INSERT agent_runs mới: `retry_of_run_id=oldRunId`, `user_prompt` copy từ run cũ, `parent_message_id` = user message gốc của run cũ.
- KHÔNG insert user message mới.
- Options default copy từ run cũ nếu body không override.
- UPDATE project processing='processing', active_run_id=newRunId.
- Run cũ + milestones giữ nguyên trong DB.

**Errors**: `RETRY_NOT_ALLOWED` (409), `PROJECT_ALREADY_PROCESSING` (409), `RUN_NOT_FOUND` (404).

---

## GET `/api/projects/:projectId/runtime/stream`

SSE stream cho dev runtime events ở mức project. Project-level, persistent, multi-subscriber.

**Response**: `text/event-stream`. Xem [sse-events.md](./sse-events.md) §Runtime channel.

**Behavior**:
- Lifetime: từ khi client connect → disconnect (page unmount). Không gắn run nào.
- Emit dev runtime events (`dev_install_*`, `dev_starting`, `dev_ready`, `dev_error`, `dev_fix_*`).
- Multi-subscriber: nhiều tab cùng project nhận chung.
- Heartbeat mỗi 15s.
- Server giữ in-memory state mới nhất per project; client connect nhận snapshot state hiện tại (nếu có) rồi nhận live updates.

---

## GET `/api/projects/:projectId/messages` (UNCHANGED)

List messages với pagination cursor. Giữ nguyên signature hiện tại.

**Query params**: `beforeCreatedAt?`, `beforeId?`, `limit?` (default 50, max 100).

**Response 200**:
```jsonc
{
  "messages": [/* Message[], bao gồm cả user + agent (mọi kind), sort createdAt ASC trong page */],
  "nextCursor": { "beforeCreatedAt": "ISO8601", "beforeId": "string" },  // optional
  "total": 123
}
```

**Note**: Messages giờ bao gồm `runId` + `kind` cho agent messages. Client dùng để group visual + render per-kind.

---

## DELETED endpoints

| Method | Path | Thay bằng |
|---|---|---|
| POST | `/api/projects/:projectId/messages` | `POST /runs` |
| GET | `/api/projects/:projectId/messages/:messageId/stream` | `GET /runs/:runId/stream` |
| POST | `/api/projects/:projectId/messages/:messageId/stop` | `POST /runs/:runId/stop` |

Xóa hoàn toàn, không deprecation period (pre-prod).
