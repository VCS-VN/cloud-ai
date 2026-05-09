# Contract: Code Tool Stream Events

## Event Invariant

Every client-visible code tool event includes trusted `projectId` and `messageId`. Event data is sanitized and must not include private reasoning, secrets, full file contents, raw patch payloads, or full raw validation logs.

## Event Types

### code_tool_loop_started

```json
{
  "type": "code_tool_loop_started",
  "projectId": "project_123",
  "messageId": "msg_456",
  "data": {
    "taskTitle": "Add wishlist button"
  }
}
```

### code_context_loaded

```json
{
  "type": "code_context_loaded",
  "projectId": "project_123",
  "messageId": "msg_456",
  "data": {
    "summary": "Project context loaded",
    "stack": ["TanStack Start", "React", "Vite"],
    "fileCount": 42
  }
}
```

### tool_call_requested

```json
{
  "type": "tool_call_requested",
  "projectId": "project_123",
  "messageId": "msg_456",
  "data": {
    "toolName": "project_search_code",
    "category": "inspect",
    "safeSummary": "Searching project source for product card components"
  }
}
```

### tool_call_completed

```json
{
  "type": "tool_call_completed",
  "projectId": "project_123",
  "messageId": "msg_456",
  "data": {
    "toolName": "project_search_code",
    "ok": true,
    "summary": "Found 2 relevant files",
    "recoverable": false
  }
}
```

### snapshot_created

```json
{
  "type": "snapshot_created",
  "projectId": "project_123",
  "messageId": "msg_456",
  "data": {
    "snapshotId": "snap_123"
  }
}
```

### patch_applied

```json
{
  "type": "patch_applied",
  "projectId": "project_123",
  "messageId": "msg_456",
  "data": {
    "changedFiles": ["src/components/ProductCard.tsx"],
    "insertions": 12,
    "deletions": 2
  }
}
```

### validation_started

```json
{
  "type": "validation_started",
  "projectId": "project_123",
  "messageId": "msg_456",
  "data": {
    "commands": ["npm run typecheck", "npm run lint"]
  }
}
```

### validation_finished

```json
{
  "type": "validation_finished",
  "projectId": "project_123",
  "messageId": "msg_456",
  "data": {
    "status": "passed",
    "summary": "Validation passed"
  }
}
```

### repair_started

```json
{
  "type": "repair_started",
  "projectId": "project_123",
  "messageId": "msg_456",
  "data": {
    "reason": "Typecheck failed after patch",
    "attempt": 1
  }
}
```

### preview_restart_required

```json
{
  "type": "preview_restart_required",
  "projectId": "project_123",
  "messageId": "msg_456",
  "data": {
    "reason": "Preview-impacting configuration changed",
    "changedFiles": ["package.json"]
  }
}
```

### code_tool_loop_completed

```json
{
  "type": "code_tool_loop_completed",
  "projectId": "project_123",
  "messageId": "msg_456",
  "data": {
    "summary": "Wishlist button added and validated",
    "changedFiles": ["src/components/ProductCard.tsx"],
    "validationStatus": "passed"
  }
}
```

### human_review_required

```json
{
  "type": "human_review_required",
  "projectId": "project_123",
  "messageId": "msg_456",
  "data": {
    "reason": "Requested change is broad or destructive",
    "changedFiles": []
  }
}
```

## Redaction Rules

- Replace recognized secrets with `[REDACTED]`.
- Truncate long summaries before streaming.
- Summarize validation logs instead of streaming full output.
- Summarize patch intent and changed files instead of streaming patch content.
- Never forward raw provider deltas to the client.
