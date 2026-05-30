# Data Model: Multi-Message Agent Runs

**Feature**: [021-multi-message-agent-runs](./spec.md)
**Date**: 2026-05-29

## Entity Relationship Overview

```text
User
 └─ owns ─> Project (1:N)
              ├─ has ─> ProjectMessage (1:N)         [role=user | role=agent]
              ├─ has ─> AgentRun (1:N)
              └─ activeRunId ──┐
                               │ (nullable FK-ish → AgentRun.id when processing)
AgentRun ─────────────────────┘
 ├─ groups ─> ProjectMessage (1:N via run_id)        [chỉ role=agent messages]
 ├─ retryOfRunId ──> AgentRun (self-ref, nullable)
 └─ derived from ─> User prompt (1 user ProjectMessage là điểm khởi)
```

**Cardinality chính**:
- 1 User prompt (1 `ProjectMessage` role=user) → 1 `AgentRun` → N `ProjectMessage` role=agent (kind milestones).
- 1 `AgentRun` có thể là retry của 1 `AgentRun` khác (chain qua `retryOfRunId`).
- 1 `Project` có tối đa 1 active run tại một thời điểm (`activeRunId`), enforced bởi `processingStatus`.

## Tables

### `agent_runs` (MODIFY)

| Column | Type | Null | Default | Change | Note |
|---|---|---|---|---|---|
| `id` | text | NO | — | keep | PK |
| `project_id` | text | NO | — | keep | index |
| `user_id` | text | YES | — | keep | index, ownership |
| ~~`message_id`~~ | ~~text~~ | — | — | **DROP** | Không còn 1-1 với 1 message |
| `parent_message_id` | text | YES | — | keep | trỏ về user prompt message gốc của run |
| `user_prompt` | text | NO | — | keep | snapshot prompt content (cho retry) |
| `intent` | json | YES | — | keep | (Constitution IX: json not jsonb — giữ nguyên) |
| `plan` | json | YES | — | keep | |
| `status` | text | NO | — | keep | enum: streaming \| completed \| failed \| stopped |
| `model_usage` | json | YES | — | keep | |
| `thinking` | json | YES | — | keep | |
| `affected_files` | json | NO | — | keep | (hiện jsonb → xem migration note) |
| `validation_result` | json | YES | — | keep | |
| `code_tool_run_state` | json | YES | — | keep | |
| `error` | json | YES | — | keep | |
| `retry_of_run_id` | text | YES | NULL | **ADD** | self-ref; NULL = run mới, set = retry |
| `reasoning_effort` | text | YES | NULL | **ADD** | enum: low \| medium \| high \| xhigh |
| `plan_mode` | boolean | NO | false | **ADD** | |
| `started_at` | timestamp | NO | — | keep | |
| `completed_at` | timestamp | YES | — | keep | |
| `created_at` | timestamp | NO | — | keep | |
| `updated_at` | timestamp | NO | — | keep | |

**Indexes**:
- `agent_runs_project_idx` on `project_id` (keep)
- `agent_runs_user_idx` on `user_id` (keep)
- ~~`agent_runs_message_idx`~~ on `message_id` (**DROP** — cột bị bỏ)
- `agent_runs_status_idx` on `status` (keep)
- `agent_runs_retry_idx` on `retry_of_run_id` (**ADD** — query retry chain)

**Migration note (Constitution IX)**: Các cột JSON hiện tại trong `agent-runs.schema.ts` đang dùng `jsonb()` (intent, plan, affected_files, ...). Theo Principle IX, schema mới phải dùng `json()`. Vì pre-prod drop & recreate, **đề xuất chuyển hết `jsonb` → `json` luôn trong migration này** để tuân thủ constitution. Đây là cleanup nằm trong scope hợp lý (cùng table đang sửa), không phải refactor adjacent code. Quyết định cuối để lại cho `/speckit-tasks` đánh dấu là 1 task riêng.

**Status state machine**:
```text
streaming ──> completed   (run.completed: agent xong, done event)
          ──> failed      (run.failed: error unrecoverable, hoặc RUN_INTERRUPTED stale)
          ──> stopped     (run.stopped: user click stop)

completed/failed/stopped là terminal — không transition tiếp.
clarification & review_required → status = completed (run đã làm xong việc của mình).
```

### `project_messages` (MODIFY)

| Column | Type | Null | Default | Change | Note |
|---|---|---|---|---|---|
| `id` | text | NO | — | keep | PK |
| `project_id` | text | NO | — | keep | |
| `user_id` | text | YES | — | keep | ownership |
| `role` | text | NO | — | keep | user \| agent |
| `content` | text | NO | — | keep | markdown thuần |
| `status` | integer | NO | 1 | keep | RecordStatus (soft delete flag) |
| `processing_status` | text | NO | 'completed' | keep | pending \| streaming \| completed \| failed \| stopped |
| `parent_message_id` | text | YES | — | keep | answer/milestone trỏ về user prompt |
| `run_id` | text | YES | NULL | **ADD** | group key; set cho role=agent, NULL cho role=user |
| `kind` | text | YES | NULL | **ADD** | enum (chỉ role=agent): plan \| answer \| clarification \| error \| review_required |
| `provider` | text | YES | — | keep | |
| `provider_response_id` | text | YES | — | keep | |
| `error_message` | text | YES | — | keep | |
| `started_at` | timestamp | YES | — | keep | |
| `completed_at` | timestamp | YES | — | keep | |
| `created_at` | timestamp | NO | — | keep | ordering key |
| `updated_at` | timestamp | YES | — | keep | |

**Indexes**:
- (existing PK on `id`)
- `project_messages_project_run_idx` on `(project_id, run_id)` (**ADD** — query messages của run)

**Validation rules**:
- `kind` MUST NULL khi `role='user'`.
- `kind` MUST set (non-NULL) khi `role='agent'`.
- `run_id` MUST set khi `role='agent'`; NULL khi `role='user'`.
- `kind='answer'` là kind duy nhất có `processing_status` có thể là `'streaming'` (đang nhận deltas). Các kind khác luôn `'completed'` ngay khi tạo (one-shot).
- `content` MUST non-empty khi message terminal, trừ trường hợp answer bị fail giữa stream (giữ partial content).

**Kind semantics**:
| Kind | Khi nào tạo | processing_status ban đầu | Content |
|---|---|---|---|
| `plan` | `change_plan` có ≥1 file op | completed | summary + file list (truncate 10) |
| `answer` | lazy, khi `assistant_message_delta` đầu tiên về | streaming | markdown text, append qua deltas |
| `clarification` | `clarification_required` / `thinking_needs_clarification` | completed | question text |
| `error` | run fail unrecoverable | completed | friendly + reason sanitized + actionable hint |
| `review_required` | `human_review_required` | completed | friendly review reason |

### `projects` (MODIFY)

| Column | Type | Null | Default | Change | Note |
|---|---|---|---|---|---|
| ... (existing fields) | | | | keep | |
| ~~`active_agent_message_id`~~ | ~~text~~ | — | — | **DROP** | thay bằng run-based |
| `active_run_id` | text | YES | NULL | **ADD** | set khi processing, NULL khi idle |
| `processing_status` | text | NO | 'idle' | keep | idle \| processing |
| `processing_started_at` | timestamp | YES | — | keep | |

**Validation rules**:
- `active_run_id` MUST non-NULL khi `processing_status='processing'`.
- `active_run_id` MUST NULL khi `processing_status='idle'`.
- Chỉ 1 run active per project (enforced bởi `processing_status` check khi createRun).

### `agent_message_chunks` (DROP TABLE)

Xóa hoàn toàn. Lý do: `project_messages.content` đã được update đồng bộ với chunk save — chunks là duplicate. Resume mid-stream chỉ cần `content` + in-memory event buffer.

## TypeScript Types (shared/project-types.ts)

### Modified types

```ts
export type MessageRole = 'user' | 'agent'
export type AgentMessageKind = 'plan' | 'answer' | 'clarification' | 'error' | 'review_required'
export type MessageProcessingStatus = 'pending' | 'streaming' | 'completed' | 'failed' | 'stopped'
export type AgentRunStatus = 'streaming' | 'completed' | 'failed' | 'stopped'
export type ProjectProcessingStatus = 'idle' | 'processing'

export type Message = {
  id: string
  userId?: string
  projectId: string
  role: MessageRole
  content: string
  status: MessageStatus
  processingStatus: MessageProcessingStatus
  parentMessageId?: string
  runId?: string                  // ADD: set cho agent, undefined cho user
  kind?: AgentMessageKind         // ADD: set cho agent, undefined cho user
  provider?: string
  providerResponseId?: string
  errorMessage?: string
  startedAt?: string
  completedAt?: string
  updatedAt?: string
  createdAt: string
}

export type Project = {
  // ... existing
  processingStatus: ProjectProcessingStatus
  activeRunId?: string            // RENAME from activeAgentMessageId
  processingStartedAt?: string
  // ...
}
```

### New types (skeleton + run UI)

```ts
export type SkeletonPhase =
  | 'starting'          // client-only optimistic
  | 'understanding'
  | 'planning'
  | 'editing'
  | 'installing'
  | 'starting_preview'
  | 'validating'
  | 'repairing'
  | 'responding'

export type SkeletonState = {
  phase: SkeletonPhase
  label: string
  detail?: string
}

export type RunUIState = {
  runId: string
  status: 'streaming' | 'completed' | 'failed' | 'stopped'
  skeleton: SkeletonState | null
  error?: StreamError
}
```

### Stream event types (see contracts/sse-events.md for full schema)

```ts
// Run channel
export type RunStreamEvent =
  | { type: 'run.started'; runId: string; projectId: string }
  | { type: 'message.created'; runId: string; messageId: string; kind: AgentMessageKind; content: string; processingStatus: MessageProcessingStatus; createdAt: string }
  | { type: 'message.delta'; runId: string; messageId: string; delta: string }
  | { type: 'message.completed'; runId: string; messageId: string; content: string }
  | { type: 'skeleton.update'; runId: string; phase: SkeletonPhase; label: string; detail?: string }
  | { type: 'run.completed'; runId: string; projectProcessingStatus: 'idle' }
  | { type: 'run.failed'; runId: string; projectProcessingStatus: 'idle'; error: StreamError }
  | { type: 'run.stopped'; runId: string; projectProcessingStatus: 'idle' }
  | { type: 'heartbeat'; runId: string }

// Runtime channel (project-level)
export type RuntimeStreamEvent =
  | DevRuntimeEvent            // existing dev_install_*, dev_starting, dev_ready, dev_error, dev_fix_*
  | { type: 'heartbeat' }
```

### Error codes (extend existing)

```ts
export type StreamErrorCode =
  | 'UNAUTHENTICATED'
  | 'PROJECT_NOT_FOUND'
  | 'PROMPT_EMPTY'
  | 'PROJECT_ALREADY_PROCESSING'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_STREAM_FAILED'
  | 'MESSAGE_NOT_FOUND'
  | 'RUN_NOT_FOUND'           // ADD
  | 'RUN_INTERRUPTED'         // ADD: stale run cleanup
  | 'STOP_NOT_ALLOWED'
  | 'RETRY_NOT_ALLOWED'      // ADD: retry chỉ cho failed run
```

## Repository interface changes

### ProjectMessageRepository
```ts
// REMOVE
saveAgentMessageChunk(...)
listAgentMessageChunks(...)

// ADD
listMessagesByRunId(runId: string, userId?: string): Promise<Message[]>
// updateMessage updates: add 'runId' | 'kind' to allowed Pick fields
```

### AgentRunRepository
```ts
// MODIFY toRun/toValues: remove messageId, add retryOfRunId, reasoningEffort, planMode
// ADD
listByRetryChain(runId: string): Promise<AgentRun[]>   // optional, cho badge "attempt N"
getActiveRun(projectId: string, userId?: string): Promise<AgentRun | undefined>
```

### ProjectRepository
```ts
// MODIFY updateProjectProcessingState signature:
//   (id, processingStatus, userId?, activeRunId?, processingStartedAt?)
//   thay activeAgentMessageId → activeRunId
```

## Data lifecycle examples

### Example 1: Run sửa code (plan + answer)
```text
t0: user gửi "thêm dark mode"
    → INSERT project_messages (role=user, run_id=NULL, kind=NULL)
    → INSERT agent_runs (id=R1, status=streaming, parent_message_id=userMsg.id)
    → UPDATE projects SET processing_status='processing', active_run_id=R1
t1: thinking_started → skeleton.update(understanding)   [no DB write]
t2: plan_created (3 file ops)
    → INSERT project_messages (role=agent, run_id=R1, kind=plan, status=completed)
    → emit message.created
t3: tool_call_requested → skeleton.update(editing)      [no DB write]
t4: assistant_message_delta đầu tiên
    → INSERT project_messages (role=agent, run_id=R1, kind=answer, status=streaming)
    → emit message.created
    → emit message.delta (mỗi delta tiếp theo, UPDATE content)
t5: done
    → UPDATE answer message SET status=completed
    → UPDATE agent_runs SET status=completed, completed_at
    → UPDATE projects SET processing_status='idle', active_run_id=NULL
    → emit message.completed + run.completed
```

### Example 2: Run text-only (chỉ answer)
```text
user hỏi "framework gì?"
→ skeleton(understanding) → skeleton(responding)
→ INSERT answer message (kind=answer)
→ stream deltas → run.completed
(KHÔNG có plan milestone vì không có file op)
```

### Example 3: Run fail trước answer
```text
user gửi prompt → run R1 streaming
→ provider error trước khi có delta nào
→ INSERT project_messages (role=agent, run_id=R1, kind=error, status=completed)
→ UPDATE agent_runs SET status=failed
→ emit message.created(error) + run.failed
(KHÔNG có answer message vì chưa có delta)
```

### Example 4: Retry
```text
R1 failed (có error milestone)
user click retry
→ INSERT agent_runs (id=R2, retry_of_run_id=R1, user_prompt=R1.user_prompt)
→ KHÔNG insert user message mới (reuse userMsg gốc, parent_message_id=userMsg.id)
→ UPDATE projects SET processing_status='processing', active_run_id=R2
→ stream như run mới
(R1 + error milestone vẫn còn trong history)
```
