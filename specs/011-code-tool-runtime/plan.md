# Implementation Plan: Code Tool Calling Runtime

**Branch**: `011-code-tool-runtime` | **Date**: 2026-05-09 | **Spec**: `specs/011-code-tool-runtime/spec.md`
**Input**: Feature specification from `/specs/011-code-tool-runtime/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a backend-owned Code Tool Calling Runtime for AI Agent message runs. The runtime lets the provider request approved project tools while the backend enforces trusted project scope, inspect-before-mutate workflow, patch-based mutations, snapshots, validation, bounded repair, sanitized streaming, preview synchronization decisions, and persistent audit state.

## Technical Context

**Language/Version**: TypeScript 6.0.3 on Node-compatible TanStack Start server runtime  
**Primary Dependencies**: TanStack Start/Router/Query, React 19, Vite 8, OpenAI Responses API client, Drizzle ORM, PostgreSQL, Zod for existing schemas, Vitest  
**Storage**: PostgreSQL via Drizzle for message run state/tool logs/project state; filesystem storage under generated project workspaces for source files and snapshots  
**Testing**: Vitest unit/integration tests plus `pnpm typecheck`, `pnpm lint`, and `pnpm build`  
**Target Platform**: Web application with server routes/actions and local generated-project filesystem runtime  
**Project Type**: Full-stack TypeScript web application and AI backend service  
**Performance Goals**: First sanitized progress event within 2 seconds for 95% of normal runs; individual safe file reads/searches complete fast enough to keep stream responsive; tool output capped to prevent oversized provider/client payloads  
**Constraints**: No arbitrary shell exposure; model-supplied project identity is untrusted; all project paths are relative and guarded; mutation requires prior inspection and project lock; secrets and private reasoning never stream to clients; patch and repair budgets are bounded  
**Scale/Scope**: One active mutation run per project; MVP includes inspection, patching, snapshot/rollback, validation/repair, streaming events, preview restart policy, and observability for generated storefront projects

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Clear code flow & feature definition**: PASS — plan separates route/message runner, tool loop, tool executor, workspace services, persistence repositories, preview service, and generated-project filesystem responsibilities.
- **II. Tests for important business rules**: PASS — safety rules require tests for path guard, inspect-before-mutate, patch blocking, validation allowlist, recoverable stream behavior, and human-review triggers.
- **III. Consistent API errors**: PASS — tool results and stream events use structured recoverable/non-recoverable error contracts; route-level failures should map to existing error format.
- **IV. No over-engineering**: PASS — MVP uses explicit backend tools and existing feature areas rather than introducing a broad plugin runtime or arbitrary shell abstraction.
- **V. UX, validation, design system**: PASS — client output is sanitized event progress; no new visual design surface is required beyond consuming typed event states.
- **VI. Role/permission security**: PASS — message route must authenticate, authorize project access, bind trusted context, and ignore model-provided project identity.
- **VII. Graph-first review**: PASS — implementation review should start with code-graph impact analysis over AI agent, route, stream, source, and persistence areas before focused route/component review.
- **VIII. Code formatting**: PASS — final implementation must run configured typecheck/lint/build and formatting-equivalent checks before merge.

## Post-Design Constitution Check

Re-check after Phase 1 design: PASS. The research decisions and design contracts preserve backend-owned execution, explicit layer boundaries, security enforcement, bounded validation/repair, no arbitrary shell access, auditability, and no unnecessary new application layers beyond the required `code-tools` bounded area.

## Project Structure

### Documentation (this feature)

```text
specs/011-code-tool-runtime/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── code-tools.contract.md
│   └── stream-events.contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── features/ai-agent/
│   ├── agent/
│   │   ├── agent-orchestrator.server.ts
│   │   ├── agent-runner.server.ts
│   │   └── agent-events.ts
│   ├── code-tools/
│   │   ├── code-tool-loop.server.ts
│   │   ├── code-tool-registry.server.ts
│   │   ├── code-tool-executor.server.ts
│   │   ├── code-tool-events.server.ts
│   │   ├── code-agent-prompts.server.ts
│   │   ├── code-agent-types.ts
│   │   ├── tools/
│   │   └── services/
│   ├── openai/
│   │   └── openai-provider.server.ts
│   ├── project/
│   │   ├── project-run-store.server.ts
│   │   ├── project-state-store.server.ts
│   │   └── snapshot-service.server.ts
│   ├── security/
│   │   ├── command-guard.server.ts
│   │   ├── path-guard.server.ts
│   │   └── secret-redactor.ts
│   └── source/
│       ├── code-index-service.server.ts
│       ├── patch-service.server.ts
│       ├── repair-service.server.ts
│       ├── retrieve-context.server.ts
│       └── validation-service.server.ts
├── db/
│   ├── schema/
│   └── migrations/
├── server/functions/
│   ├── project-message-stream.ts
│   └── project-messages.ts
└── server/repositories/
    ├── agent-run-repository.ts
    ├── message-repository.ts
    ├── project-repository.ts
    ├── project-snapshot-repository.ts
    └── project-state-repository.ts

tests/
└── setup.ts
```

**Structure Decision**: Implement the runtime inside `src/features/ai-agent/code-tools` as a new bounded area, while reusing existing AI provider, project state, source, security, route, and repository modules. Add database schema/migrations only for missing persistent audit/run-state fields. Keep generated-project filesystem operations behind services and never expose raw shell or direct filesystem access to the provider.

## Complexity Tracking

No constitution violations require justification.
