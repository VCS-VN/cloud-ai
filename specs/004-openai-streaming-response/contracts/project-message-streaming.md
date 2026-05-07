# Contract: Project Message Streaming

## Goals

- Persist the user prompt before generation starts.
- Stream an agent response to the project detail UI.
- Persist accepted response chunks and roll up final/partial content into the agent message.
- Let the user stop an active generation.
- Keep all provider credentials and ownership checks on the server.

## Server Function: Send Project Message

Existing server function to update:

```text
sendProjectMessage(data: { projectId: string; content: string })
```

### Success Response

```json
{
  "project": {
    "id": "project-id",
    "processingStatus": "processing",
    "activeAgentMessageId": "agent-message-id"
  },
  "userMessage": {
    "id": "user-message-id",
    "projectId": "project-id",
    "role": "user",
    "content": "Build a landing page...",
    "processingStatus": "completed",
    "createdAt": "2026-05-06T00:00:00.000Z"
  },
  "agentMessage": {
    "id": "agent-message-id",
    "projectId": "project-id",
    "role": "agent",
    "content": "",
    "processingStatus": "pending",
    "parentMessageId": "user-message-id",
    "createdAt": "2026-05-06T00:00:00.001Z"
  },
  "stream": {
    "url": "/api/projects/project-id/messages/agent-message-id/stream"
  }
}
```

### Error Response Shape

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found."
  }
}
```

### Required Error Codes

- `UNAUTHENTICATED`
- `PROJECT_NOT_FOUND`
- `PROMPT_EMPTY`
- `PROJECT_ALREADY_PROCESSING`
- `PROVIDER_NOT_CONFIGURED`

## SSE Endpoint: Stream Agent Message

```text
GET /api/projects/:projectId/messages/:agentMessageId/stream
Accept: text/event-stream
```

The endpoint must use the authenticated session, verify project ownership, verify the agent message belongs to the project, load the latest prompt plus existing project message history, and start the server-side OpenAI stream.

### Event: message.started

```text
event: message.started
data: {"projectId":"project-id","messageId":"agent-message-id","processingStatus":"streaming"}
```

### Event: message.delta

```text
event: message.delta
data: {"messageId":"agent-message-id","sequence":1,"delta":"First streamed text"}
```

### Event: message.completed

```text
event: message.completed
data: {"messageId":"agent-message-id","content":"Final response text","processingStatus":"completed","projectProcessingStatus":"idle"}
```

### Event: message.failed

```text
event: message.failed
data: {"messageId":"agent-message-id","content":"Partial text if any","processingStatus":"failed","projectProcessingStatus":"idle","error":{"code":"PROVIDER_STREAM_FAILED","message":"Unable to complete the response."}}
```

### Event: message.stopped

```text
event: message.stopped
data: {"messageId":"agent-message-id","content":"Partial text if any","processingStatus":"stopped","projectProcessingStatus":"idle"}
```

### Event: heartbeat

```text
event: heartbeat
data: {"messageId":"agent-message-id"}
```

## Server Function: Stop Generation

```text
stopProjectGeneration(data: { projectId: string; agentMessageId: string })
```

### Success Response

```json
{
  "project": {
    "id": "project-id",
    "processingStatus": "idle",
    "activeAgentMessageId": null
  },
  "agentMessage": {
    "id": "agent-message-id",
    "processingStatus": "stopped",
    "content": "Partial text if any"
  }
}
```

### Required Behavior

- If the stream is active, abort provider generation and stop emitting deltas.
- If partial content exists, preserve it.
- If no content exists, persist an empty stopped agent message or a short stopped placeholder.
- If the message is already completed or failed, return the current terminal state without changing content.

## Client UI Contract

- Project detail page owns stream lifecycle and message list updates.
- Agent message placeholder appears immediately after `sendProjectMessage` succeeds.
- Delta events append to the matching agent message content.
- Stop button is visible only while the active agent message is pending or streaming.
- Composer submit is disabled while the project is processing.
- Icons must use `--app-icon`, `--app-icon-muted`, `--app-icon-subtle`, `--app-icon-selected`, or `--app-icon-on-color-block`.
- User-visible labels, errors, and status text must be English.
