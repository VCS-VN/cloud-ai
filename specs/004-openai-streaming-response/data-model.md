# Data Model: AI Streaming Responses

## Project

Represents a user-owned project.

### Existing Fields Used

- `id`: Project identifier.
- `userId`: Owner identifier.
- `name`: Display name derived from the prompt.
- `description`: Short project description.
- `initialPrompt`: First prompt submitted from dashboard.
- `status`: Existing record visibility/lifecycle compatibility field.
- `createdAt`, `updatedAt`: Timestamps.
- `pwa`: Existing project PWA configuration.

### New / Updated Fields

- `processingStatus`: `"idle" | "processing"`.
- `activeAgentMessageId`: Optional message id for the currently streaming agent message.
- `processingStartedAt`: Optional timestamp for active generation start.

### Validation Rules

- Only one project generation can have `processingStatus = "processing"` at a time.
- `activeAgentMessageId` must be set when `processingStatus = "processing"`.
- `processingStatus` must return to `"idle"` when the active agent message becomes completed, failed, or stopped.
- Project ownership must be checked before read, prompt submission, stream start, or stop.

## Message

Represents a visible conversation item in a project.

### Existing Fields Used

- `id`: Message identifier.
- `userId`: Owner identifier.
- `projectId`: Parent project identifier.
- `role`: `"user" | "agent"`.
- `content`: Rendered message content.
- `status`: Existing active/inactive record flag.
- `processingStatus`: Existing message lifecycle field.
- `createdAt`: Creation timestamp.

### New / Updated Fields

- `processingStatus`: Extend to `"pending" | "streaming" | "completed" | "failed" | "stopped"`.
- `parentMessageId`: For an agent message, the triggering user message id.
- `provider`: Optional provider identifier, initially `"openai"` for agent messages.
- `providerResponseId`: Optional OpenAI response id when available.
- `errorMessage`: Optional user-safe failure message.
- `startedAt`: Optional timestamp when streaming begins.
- `completedAt`: Optional timestamp when the final state is reached.
- `updatedAt`: Last content/state update timestamp.

### Validation Rules

- User messages must have role `"user"`, non-empty content, and `processingStatus = "completed"` once saved.
- Agent messages created for streaming start with empty content or accepted partial content and `processingStatus = "pending"` or `"streaming"`.
- Completed agent messages must have final content.
- Failed and stopped agent messages may have empty or partial content, but must be visibly marked with their final state.
- Agent messages must reference the triggering user message through `parentMessageId`.

## AgentMessageChunk

Represents accepted streamed text deltas for an agent message.

### Fields

- `id`: Chunk identifier.
- `projectId`: Parent project identifier.
- `messageId`: Agent message identifier.
- `userId`: Owner identifier.
- `sequence`: Monotonic sequence number per agent message.
- `content`: Accepted text delta for this chunk.
- `providerEventType`: Optional provider event category mapped by the server.
- `createdAt`: Chunk persistence timestamp.

### Validation Rules

- `messageId` must reference an agent message.
- `(messageId, sequence)` must be unique.
- `content` must be non-empty for delta chunks.
- Chunks are append-only for a given message.

## Generation State

Represents the lifecycle of one agent response.

### States

```text
pending -> streaming -> completed
pending -> streaming -> failed
pending -> streaming -> stopped
pending -> stopped
```

### State Transition Rules

- `pending` is used after the agent message is created and before provider text is accepted.
- `streaming` begins when provider generation starts or the first delta is accepted.
- `completed` is terminal and stores final response content.
- `failed` is terminal and preserves partial content if any text was already shown.
- `stopped` is terminal and preserves partial content if any text was already shown.
- Terminal messages cannot be stopped or streamed again.

## Relationships

- A `Project` has many `Message` rows.
- A user `Message` can have one linked agent response through `Message.parentMessageId`.
- An agent `Message` has many `AgentMessageChunk` rows.
- A `Project` may point to one active agent message while `processingStatus = "processing"`.
