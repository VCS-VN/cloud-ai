# Implementation Plan: Manual Preview Button for Inactive Projects

**Branch**: `004-preview-button` | **Date**: 2026-05-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-preview-button/spec.md`

## Summary

Add a "Start Preview" button to the project detail page that allows users to manually start a dev server process for projects without a running process. The button checks for existing processes before starting, auto-loads the preview UI on success, and hides itself when a process is already running. Extends existing `ProcessManager`, `RuntimeService`, `PreviewInitPanel`, and `DevRuntime` database state infrastructure.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, TanStack Start + Router
**Primary Dependencies**:
- `@tanstack/react-start` — server functions (`createServerFn`)
- `node:child_process` — spawn for `pnpm dev`
- `@tanstack/react-query` — state management, refetching
- Drizzle ORM + PostgreSQL — `project_states.dev_runtime` JSON column
- Existing: `ProcessManager`, `RuntimeService`, `ProjectStateStore`, `ProjectService`, `DevRuntime` type
**Storage**: PostgreSQL (`project_states.dev_runtime` JSON column — uses `json()` per Constitution Principle IX) + in-memory `ProcessManager.processes` Map
**Testing**: Existing patterns in `src/server/functions/` (e.g., `project-message-stream.test.ts`)
**Target Platform**: Linux/macOS server (Node.js), Web browser (React/TanStack)
**Project Type**: Full-stack web application (TanStack Start)
**Performance Goals**: Preview starts within 10 seconds of button click; UI responds within 200ms of state change
**Constraints**:
- Must prevent duplicate dev server processes for the same project
- Must use DESIGN.md component tokens (pill buttons, `--app-control`, `--app-icon-muted`, `--app-panel`, etc.)
- Must use `@/` import alias convention (Constitution Principle X)
- `ProcessManager` is in-memory per server process; multiple server instances won't share process state
- Server functions (`createServerFn`) run on the server; client calls them transparently
**Scale/Scope**: Single-user-per-project preview; one dev server process per project at a time

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Clear code flow & features | ✅ PASS | New server functions + service methods follow existing patterns |
| II. Test for business rules | ✅ PASS | Unit tests for `ProjectService.getDevRuntimeState` and `startPreview` |
| III. Consistent API errors | ✅ PASS | Uses existing error handling pattern in server functions |
| IV. No over-engineer | ✅ PASS | Minimal addition: button + server fn + service method |
| V. UX + Design System | ✅ PASS | Follows DESIGN.md pill buttons, token colors, spacing |
| VI. Role/permission security | ✅ PASS | `requireServerUser()` + project ownership check |
| VII. Code Review (Graph) | ✅ PASS | All changes scoped to preview-related files |
| VIII. ESLint formatting | ✅ PASS | Will run format before commit |
| IX. Database JSON type | ✅ PASS | `dev_runtime` already uses `json()` in Drizzle schema |
| X. Import Alias | ✅ PASS | All imports use `@/` or relative `./` |

## Project Structure

### Documentation (this feature)

```text
specs/004-preview-button/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output (interface contracts)
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── functions/
│   │   └── preview.ts           # Already has stubs for getDevRuntimeState + startPreview
│   ├── services/
│   │   ├── project-service.ts   # Add getDevRuntimeState() + startPreview() methods
│   │   └── project-services.ts  # Already wires ProcessManager + ProjectStateStore
│   └── repositories/
│       └── project-state-repository.ts  # Already supports readDevRuntime/saveDevRuntime
├── features/ai-agent/
│   ├── runtime/
│   │   ├── process-manager.server.ts   # Already has startDevServer/stop/isRunning
│   │   ├── runtime-service.server.ts   # Already has runPostInitDev (install+start flow)
│   │   └── runtime-events.ts           # Already has DevRuntimeEvent types
│   └── project/
│       ├── project-state-store.server.ts  # Already has readDevRuntime/saveDevRuntime
│       └── project-state.schema.ts        # Already has DevRuntime type
├── components/
│   └── projects/
│       └── PreviewInitPanel.tsx    # Already exists (needs wiring to server fn)
└── routes/
    └── projects/
        └── $projectId.tsx          # PreviewWorkspace + PreviewToolbar (needs button integration)
```

**Structure Decision**: Single project structure. Changes scoped to:
1. `src/server/services/project-service.ts` — add `getDevRuntimeState()` and `startPreview()` methods
2. `src/routes/projects/$projectId.tsx` — wire `PreviewInitPanel.onStartPreview` to server function, handle loading/error states, auto-refresh workspace data
3. `src/components/projects/PreviewInitPanel.tsx` — already exists; minor DESIGN.md compliance adjustments
4. `src/server/functions/preview.ts` — already has stubs; ensure they work with new service methods

## Complexity Tracking

No constitution violations requiring justification. The feature extends existing patterns without introducing new abstractions, frameworks, or architectural patterns.
