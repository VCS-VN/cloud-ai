# Research: AI Streaming Responses

**Date**: 2026-05-06
**Feature**: AI Streaming Responses

## Decision: Use the OpenAI Responses API streaming path through the installed SDK

**Rationale**: The project already depends on `openai` `^6.36.0`. OpenAI's official streaming guidance describes using `stream: true` and consuming semantic server-sent events from the Responses API. This maps cleanly to a server-side provider that can translate OpenAI events into the app's own browser-safe SSE events. Source: [OpenAI streaming responses guide](https://platform.openai.com/docs/guides/streaming-responses), [Responses API reference](https://platform.openai.com/docs/api-reference/responses).

**Alternatives considered**:

- Keep placeholder `ChatGptProvider`: rejected because the feature requires real streamed agent responses.
- Use Chat Completions streaming first: rejected because the Responses API is the current unified endpoint for stateful model responses and semantic streaming events.
- Stream directly from browser to OpenAI: rejected because API keys must stay server-side and project ownership must be checked before generation.

## Decision: Server translates provider stream into application SSE events

**Rationale**: Browser UI needs incremental text, final state, and stop handling without exposing provider credentials. A server-owned SSE stream keeps authentication, ownership checks, provider request construction, partial persistence, and final state transitions inside the trusted backend. The client only receives application events such as `message.delta`, `message.completed`, `message.failed`, and `message.stopped`.

**Alternatives considered**:

- Poll for message updates: rejected because it does not provide smooth token-by-token or segment-by-segment UX.
- WebSocket: rejected as unnecessary for one server-to-client generation stream and explicit stop support.
- Return one JSON response after completion: rejected because it does not satisfy progressive UI feedback.

## Decision: Persist streamed chunks and roll up content into the agent message

**Rationale**: The feature explicitly asks for a chunked message table for agent messages. Persisting accepted chunks by sequence allows refresh recovery, audit of partial responses, and accurate stopped/failed states while the `project_messages.content` field remains the primary rendered message body after rollup.

**Alternatives considered**:

- Persist only final content: rejected because stopped and failed partial responses must survive refresh.
- Persist every provider event verbatim: rejected because application rendering only needs accepted text deltas plus limited metadata; raw provider events would over-couple storage to OpenAI internals.

## Decision: Project tracks active processing only; message tracks final lifecycle state

**Rationale**: Clarification resolved that project status is only `idle` or `processing`, while messages carry `completed`, `failed`, or `stopped`. This prevents the project row from becoming a historical response-state log and keeps final lifecycle state with the entity users see in the conversation.

**Alternatives considered**:

- Put completed/failed/stopped on project: rejected because the project can contain many messages with different final states.
- Remove project processing state entirely: rejected because the UI needs a clear project-level "currently generating" indicator.

## Decision: Standardize OpenAI server env vars and keep optional legacy compatibility

**Rationale**: The official OpenAI SDK convention is server-side `OPENAI_API_KEY`, with model selection controlled by app configuration. The current project has generic `AI_PROVIDER`, `AI_MODEL`, and `AI_API_KEY`. The implementation should add `OPENAI_API_KEY`, `OPENAI_MODEL`, optional `OPENAI_BASE_URL`, and `OPENAI_TIMEOUT_MS` to `.env.example`, while `loadAIEnv` may temporarily map existing `AI_*` values to avoid breaking local setups.

**Alternatives considered**:

- Keep only generic `AI_*`: rejected because this feature is specifically OpenAI-backed and the SDK already recognizes `OPENAI_API_KEY`.
- Hardcode model or key names: rejected because deployment config must remain environment-specific.

## Decision: UI follows `DESIGN.md` tokens and existing app semantic tokens

**Rationale**: The feature touches message bubbles, loading states, stop controls, and icons. `DESIGN.md`, `app/styles/globals.css`, and `AGENTS.md` require tokenized colors, circular icon buttons, pill CTAs, subtle transitions, and semantic icon tokens such as `--app-icon`, `--app-icon-muted`, `--app-icon-subtle`, `--app-icon-selected`, and `--app-icon-on-color-block`.

**Alternatives considered**:

- Raw Tailwind colors for status UI: rejected by project design rules.
- Provider-branded colors for OpenAI state: rejected because the app has its own design system and the OpenAI logo is not required.

## Decision: Use existing code flow discovered by code-review graph and source inspection

**Rationale**: The code-review graph identifies `ProjectDetailPage`, `projects-handle`, and auth/project communities as the relevant areas. Source inspection confirms the active flow runs through `src/routes/projects/$projectId.tsx`, `src/server/functions/project-messages.ts`, `MessageService`, `PgProjectMessageRepository`, and Drizzle schema files. Planning around those boundaries reduces blast radius.

**Alternatives considered**:

- Add a separate chat module tree: rejected because it duplicates existing project message components and service/repository contracts.
- Implement streaming in the dashboard page: rejected by clarification; dashboard redirects immediately after project and user message persistence.
