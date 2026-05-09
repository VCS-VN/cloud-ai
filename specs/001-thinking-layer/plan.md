# Implementation Plan: AI Provider Thinking Layer

**Branch**: `010-thinking-layer` | **Date**: 2026-05-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-thinking-layer/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Introduce a schema-first Thinking Layer for the AI website builder so every user prompt is interpreted, validated, optionally repaired, and converted into a safe Agent Task before planning, source initialization, patch generation, validation, preview refresh, or project state updates occur. The implementation will align the existing `src/features/ai-agent/thinking` module with the new contract, integrate sanitized thinking events into the current agent orchestrator, and add tests covering schema validation, business validation, fallback behavior, event sanitization, and downstream task mapping.

## Technical Context

**Language/Version**: TypeScript 6.0.3, React 19.2.6, Node-compatible server runtime through TanStack Start  
**Primary Dependencies**: TanStack Start, TanStack Router, TanStack Query, Vite 8, OpenAI provider client, Zod 4, Drizzle/Postgres project stores, Vitest 4  
**Storage**: Existing project run/state stores backed by repository/database layer; Thinking Layer persists only validated summaries/results where project run storage already supports it  
**Testing**: Vitest unit and integration tests; `pnpm typecheck`; `pnpm lint`; targeted tests under `src/features/ai-agent/thinking` and orchestration/provider boundaries  
**Target Platform**: Server-side web application code serving the AI website builder and streaming client events  
**Project Type**: Web application with server-side AI orchestration and client-facing streaming UI  
**Performance Goals**: Thinking analysis completes or fails safely within 30 seconds for at least 95% of normal prompts; downstream pipeline starts only after validated analysis completes  
**Constraints**: Do not expose raw provider output or hidden reasoning; do not mutate project state inside Thinking Layer; destructive and stack-changing requests require clarification; avoid new architecture layers beyond existing ai-agent module boundaries  
**Scale/Scope**: One AI agent feature area, current project/source stores, current OpenAI provider abstraction, one SSE/client event stream, representative init/update/destructive/prompt-injection scenarios

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Clear code flow & feature definition**: PASS — Plan defines clear flow from route/orchestrator → Thinking Layer → Agent Task → planner/source services, with repository/database interaction limited to existing project run/state stores.
- **II. Tests for important business rules**: PASS — Business validator, destructive/stack-change clarification, retry/repair fallback, sanitized events, and Agent Task mapping require targeted tests.
- **III. Consistent API errors**: PASS — Provider timeout and malformed output become existing agent error/clarification events; no new raw error format is exposed to clients.
- **IV. No over-engineering**: PASS — Reuse existing `ai-agent` structure, OpenAI provider, project stores, and event stream; add only contracts required by the spec.
- **V. UX validation & design system compliance**: PASS — UI impact is limited to existing event timeline/stream handling for sanitized events; no new visual system changes are planned.
- **VI. Role/permission security**: PASS — Thinking Layer receives `userId`/project context from the existing authenticated flow and does not add privileged bypasses.
- **VII. Code review & impact analysis ưu tiên Graph**: PASS — Implementation review should start with graph/impact analysis around `src/features/ai-agent` before route/component review.
- **VIII. Code formatting**: PASS — Run project typecheck/lint after implementation and keep formatting consistent with existing TypeScript style.

## Project Structure

### Documentation (this feature)

```text
specs/001-thinking-layer/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── agent-task.md
│   ├── thinking-result.md
│   └── stream-events.md
└── tasks.md
```

### Source Code (repository root)

```text
src/features/ai-agent/
├── agent/
│   ├── agent-events.ts
│   └── agent-orchestrator.server.ts
├── api/
│   └── sse.server.ts
├── openai/
│   ├── openai-client.server.ts
│   ├── openai-provider.server.ts
│   └── structured-output-parser.ts
├── planning/
│   ├── classify-intent.server.ts
│   └── create-change-plan.server.ts
├── project/
│   ├── project-run-store.server.ts
│   ├── project-state-store.server.ts
│   └── project-state.schema.ts
├── source/
│   ├── init-source.server.ts
│   ├── patch-generator.server.ts
│   ├── patch-service.server.ts
│   ├── repair-service.server.ts
│   └── validation-service.server.ts
├── thinking/
│   ├── thinking.schema.ts
│   ├── thinking-json-schema.ts
│   ├── thinking.prompt.ts
│   ├── thinking-service.server.ts
│   ├── thinking-business-validator.ts
│   ├── thinking-fallback.ts
│   ├── thinking-events.mapper.ts
│   ├── thinking-to-agent-task.ts
│   ├── thinking-orchestrator.server.ts
│   └── thinking.test.ts
└── ui/
    ├── agent-event-reducer.ts
    ├── agent-event-timeline.tsx
    └── use-agent-stream.ts
```

```text
src/routes/api/projects/$projectId/
└── agent.stream.ts or existing project agent stream route
```

**Structure Decision**: Use the existing single web application layout. The feature remains inside `src/features/ai-agent`, with Thinking-specific contracts under `thinking/`, orchestration wiring under `agent/`, project persistence under `project/`, and stream UI consumption under `ui/`. No new top-level package or separate service is needed.

## Phase 0: Research Summary

See [research.md](./research.md) for decisions. Key outcomes:

- Use non-stream structured provider calls for Thinking Result generation by default.
- Keep external client streaming active with sanitized status/result events only.
- Validate provider output in three layers: parse/shape validation, business validation, optional business repair.
- Convert validated Thinking Result into Agent Task before planner/source services run.
- Persist safe analysis summaries and redact or avoid raw provider outputs.

## Phase 1: Design Summary

- Data model is documented in [data-model.md](./data-model.md).
- Contracts are documented in [contracts/thinking-result.md](./contracts/thinking-result.md), [contracts/agent-task.md](./contracts/agent-task.md), and [contracts/stream-events.md](./contracts/stream-events.md).
- Validation and local verification steps are documented in [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

- **I. Clear code flow & feature definition**: PASS — Contracts now define Thinking Input/Result, Agent Task, and stream events; plan identifies exact module boundaries.
- **II. Tests for important business rules**: PASS — Quickstart and contracts identify unit/integration coverage for schema, business validation, repair, fallback, event sanitization, and orchestrator blocking.
- **III. Consistent API errors**: PASS — Stream event contract includes safe `error` and `clarification_required` outcomes instead of raw provider failures.
- **IV. No over-engineering**: PASS — Design reuses existing provider and store abstractions and limits new files to the minimum contracts/validators/mappers required.
- **V. UX validation & design system compliance**: PASS — UI receives safe event shapes only; no design token changes are introduced.
- **VI. Role/permission security**: PASS — No direct file writes, command execution, or ProjectState mutation occurs inside Thinking Layer.
- **VII. Code review & impact analysis ưu tiên Graph**: PASS — Review should focus on ai-agent graph impact and event/client consumers before route details.
- **VIII. Code formatting**: PASS — Verification includes `pnpm typecheck`/`pnpm lint` and targeted tests.

## Complexity Tracking

No constitution violations require complexity justification.
