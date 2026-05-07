# Implementation Plan: AI Streaming Responses

**Branch**: `006-openai-streaming-response` | **Date**: 2026-05-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/004-openai-streaming-response/spec.md`

## Summary

Integrate the installed OpenAI SDK into the project message flow so authenticated project owners can submit prompts, immediately persist the user message, stream the agent response in the project detail conversation, stop generation, and preserve completed, failed, or stopped response state. The implementation will keep the existing TanStack Start UI, server function, service, repository, and Drizzle database boundaries, add a server-owned OpenAI streaming provider, expose a project-detail streaming contract, and update the chat UI with polished loading, streaming, stopped, failed, and retry states using `DESIGN.md` tokens.

## Technical Context

**Language/Version**: TypeScript, React, TanStack Start, Node-compatible server runtime  
**Primary Dependencies**: `@tanstack/react-start`, `@tanstack/react-router`, `drizzle-orm`, `postgres`, `openai`, `lucide-react`, `zod`  
**Storage**: PostgreSQL via Drizzle schema and migrations  
**Testing**: Vitest plus TypeScript checks through `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`  
**Target Platform**: Web application with server-rendered/server-function backend and browser UI  
**Project Type**: Full-stack web application  
**Performance Goals**: First visible processing feedback within 2 seconds after prompt persistence; stream visible text progressively; resolve each prompt to completed, failed, or stopped state within the 60-second success target when provider response allows  
**Constraints**: One active generation per project; text-only prompts/responses; no token counting, images, queued messages, or project template generation in this feature; all project/user-facing text in English; UI icons and colors must use semantic theme tokens from `DESIGN.md` and `app/styles/globals.css`  
**Scale/Scope**: Existing authenticated project owner flows in dashboard and project detail; existing project list, file explorer, preview/code panels, and auth boundaries remain in place

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Requirements are clear, confirmed, with explicit code flow (UI client, flow service, repository, database)
- [x] Architecture is simple and avoids over-engineering
- [x] API responses and stream error events follow consistent error formats
- [x] Security/roles are checked through existing authenticated project ownership checks
- [x] UX/transitions are smooth and strictly use semantic tokens from `DESIGN.md`
- [x] Code formatting, ESLint/typecheck, and code-review-graph priorities are acknowledged for final stages

## Project Structure

### Documentation (this feature)

```text
specs/004-openai-streaming-response/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── project-message-streaming.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── ai/
│   ├── ai-provider.ts
│   ├── chatgpt-provider.ts
│   ├── env.ts
│   └── prompt-builder.ts
├── components/
│   └── projects/
│       ├── MessageBubble.tsx
│       ├── MessageComposer.tsx
│       └── ProjectMessagesPanel.tsx
├── db/
│   ├── schema.ts
│   ├── schema/
│   │   ├── projects.schema.ts
│   │   ├── project-messages.schema.ts
│   │   └── agent-message-chunks.schema.ts
│   └── migrations/
├── routes/
│   ├── dashboard/index.tsx
│   └── projects/$projectId.tsx
├── server/
│   ├── functions/
│   │   ├── project-messages.ts
│   │   └── projects.ts
│   ├── repositories/
│   │   ├── message-repository.ts
│   │   └── project-repository.ts
│   └── services/
│       ├── message-service.ts
│       ├── project-service.ts
│       └── project-services.ts
└── shared/
    └── project-types.ts

tests/
├── ai/
├── server/
└── components/
```

**Structure Decision**: Use the current full-stack TanStack Start structure. UI changes stay under `src/components/projects` and `src/routes`; business flow stays in `src/server/services`; persistence stays in repositories and Drizzle schema; OpenAI integration stays in `src/ai`. No new app package or worker process is introduced because queued generation is out of scope.

## Code Flow

1. Dashboard prompt flow: `src/routes/dashboard/index.tsx` calls `createProjectFromPrompt`, which saves the project and user message, returns the project workspace, navigates immediately to `/projects/$projectId`, and lets the project detail page start or resume streaming.
2. Project detail prompt flow: `MessageComposer` submits to `sendProjectMessage`, which validates ownership, saves the user message, creates an agent message in streaming/pending state, marks the project `processing`, and returns IDs plus the stream contract.
3. Client stream flow: `src/routes/projects/$projectId.tsx` renders the user message and agent placeholder, connects to the stream endpoint, appends delta text into the agent message without layout shift, and exposes a stop button while streaming is active.
4. Server stream flow: the stream endpoint loads project ownership and message history, calls the OpenAI provider with the latest prompt plus project message history, emits SSE events to the browser, persists each accepted delta chunk, updates the agent message content/state, and returns project processing state to idle on completed, failed, stopped, or aborted requests.
5. Repository/database flow: `message-repository.ts` persists user/agent messages and chunk rows; `project-repository.ts` updates project processing state; schema/migrations add message lifecycle fields, project processing fields, and the agent chunk table.

## Phase 0: Research Complete

See [research.md](research.md). Decisions resolved:

- Use OpenAI Responses API streaming through the installed `openai` SDK.
- Use server-sent events from the app server to the browser for incremental text.
- Standardize provider configuration on OpenAI-specific server env vars while optionally mapping existing `AI_*` variables during migration.
- Persist chunk rows for accepted agent deltas and roll them up into the agent message content.
- Keep final completed/failed/stopped state on messages and only active idle/processing state on projects.

## Phase 1: Design Complete

Generated artifacts:

- [data-model.md](data-model.md)
- [contracts/project-message-streaming.md](contracts/project-message-streaming.md)
- [quickstart.md](quickstart.md)
- Updated [AGENTS.md](../../AGENTS.md) plan pointer

## Post-Design Constitution Check

- [x] UI client, flow service, repository, and database boundaries are explicitly mapped
- [x] No extra queue, worker, or template-generation subsystem is introduced
- [x] Error paths are represented in JSON contracts and SSE `error` events
- [x] Existing authenticated project ownership checks remain mandatory before mutation or streaming
- [x] Message, loading, stop, and status UI must use existing semantic tokens and subtle transitions
- [x] Verification includes TypeScript, tests, build, and graph-aware review of changed flows

## Complexity Tracking

No constitution violations. The additional `agent_message_chunks` table is required by the feature request to persist streamed chunks and support recoverable completed, failed, and stopped rollups.
