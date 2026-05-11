# Research: Manual Preview Button

## Decision 1: How to start preview from user click

- **Decision**: Call `startPreview` server function which delegates to `ProjectService.startPreview()`, which uses existing `RuntimeService.runPostInitDev()` flow
- **Rationale**: The infrastructure already exists (`ProcessManager.startDevServer`, `RuntimeService.runPostInitDev`, `ProjectStateStore.saveDevRuntime`). Reuse the same async generator pattern but called from a button click instead of automatically after project creation
- **Alternatives considered**: 
  - Direct `ProcessManager.startDevServer` call from server function — rejected because it bypasses state management and install checks
  - New standalone preview starter — rejected because it would be unnecessary duplication of existing logic

## Decision 2: How to detect existing process

- **Decision**: Check `dev_runtime.status` from `project_states` table via `ProjectStateStore.readDevRuntime()`, then verify with `ProcessManager.isRunning(projectId)`
- **Rationale**: Two-layer check handles both persistent state (DB) and in-memory process state. DB tells us if a process was started; `isRunning` tells us if it's still alive
- **Alternatives considered**: 
  - Only check DB — rejected because process could have crashed without updating DB
  - Only check in-memory — rejected because server restart loses state

## Decision 3: How to handle auto-load when process exists

- **Decision**: On workspace load (`getProjectWorkspace`), check `devRuntime.status`. If `running`, the `PreviewWorkspace` component already shows the iframe. If `idle`/`stopped`, show `PreviewInitPanel` with start button
- **Rationale**: The current `PreviewWorkspace` component already has this conditional logic (`showIframe` vs `showInitPanel`). Just need to ensure the workspace data is refreshed when returning to a project
- **Alternatives considered**: 
  - Separate API call just for process status — rejected because `getProjectWorkspace` already returns `devRuntime`
  - Polling endpoint — rejected because workspace loader covers it on navigation

## Decision 4: Error handling flow

- **Decision**: Server function catches errors and returns structured result `{ success: boolean; error?: string; previewUrl?: string; port?: number }`. Client uses error string to show in `PreviewInitPanel`
- **Rationale**: Matches existing pattern in `project-messages.ts` server functions. Simple, testable, and consistent
- **Alternatives considered**: 
  - Throw errors — rejected because TanStack Start server functions handle errors better as structured responses
  - SSE-based error streaming — rejected as over-engineering for a single start action

## Decision 5: Process state synchronization

- **Decision**: After `startPreview` succeeds, the client refetches the workspace via `getProjectWorkspace` to get updated `devRuntime` state
- **Rationale**: `getProjectWorkspace` already fetches `devRuntime` from the store. Refetching ensures the iframe URL and runtime state are current without duplicating state logic on the client
- **Alternatives considered**: 
  - Manually update local state — rejected because of risk of drift from actual server state
  - WebSocket push — rejected as over-engineering for this scope

## Decision 6: UI Button design compliance (DESIGN.md)

- **Decision**: The preview start button uses DESIGN.md `button-primary` style: pill shape (`rounded-full`), black background (`--app-control` → `#000000`), white text, `figmaSans` at 20px/480 weight
- **Rationale**: Follows the project's established design system. The `PreviewInitPanel.tsx` already uses these tokens correctly
- **Alternatives considered**: Custom colored button — rejected because DESIGN.md reserves saturated colors for specific semantic purposes
