# Quickstart: Manual Preview Button

## How to test this feature:

1. Start the dev server: `pnpm dev`
2. Navigate to a project that has been created but has no running dev server process
3. In the Preview tab, you should see a "Start Preview" button
4. Click the button — the UI should show a loading spinner
5. After 5-15 seconds (depending on project size), the preview iframe should load
6. Navigate away and back to the project — the preview should auto-load without needing the button
7. Test error case: Delete or corrupt the project's `package.json` and click Start Preview — an error message should display with a Retry button
8. Test duplicate prevention: Click Start Preview twice rapidly — only one process should spawn

## Project structure overview:

```
src/
├── server/
│   ├── functions/preview.ts          # Server functions (getDevRuntimeState, startPreview)
│   ├── services/project-service.ts   # Service layer (getDevRuntimeState, startPreview methods)
│   └── services/project-services.ts  # Dependency wiring
├── features/ai-agent/
│   ├── runtime/process-manager.server.ts   # Process lifecycle (start, stop, isRunning)
│   ├── runtime/runtime-service.server.ts   # Dev runtime flow (install, start, error handling)
│   └── runtime/runtime-events.ts           # Event types for streaming
├── components/projects/PreviewInitPanel.tsx # UI component for start button
└── routes/projects/$projectId.tsx           # Project detail page
```

## Key flow:

### Start Preview Flow:
1. User clicks "Start Preview" button in PreviewInitPanel
2. Client calls `startPreview` server function
3. Server function validates user ownership
4. Checks if process already exists via `ProcessManager.isRunning()`
5. If exists, returns `{ alreadyRunning: true }`
6. If not, calls `RuntimeService.runPostInitDev()` which:
   - Updates `devRuntime.status` to "starting" in DB
   - Spawns `pnpm dev` via `ProcessManager.startDevServer()`
   - Parses stdout for Vite ready URL
   - Updates `devRuntime.status` to "running" with previewUrl
   - Yields events back to client
7. Client receives success and updates UI state
8. PreviewWorkspace shows iframe with running preview

### Error Flow:
1. If `pnpm dev` fails to start, `RuntimeService` catches the error
2. Updates `devRuntime.status` to "error" with `lastError` and `lastErrorTier`
3. Error event is yielded back to client
4. PreviewInitPanel shows error message with Retry button
5. On retry, flow starts again from step 1

### Stop Preview Flow:
1. Server function calls `ProcessManager.stop(projectId)`
2. Sends SIGTERM, waits 5s grace period, then SIGKILL if needed
3. Updates `devRuntime.status` to "stopped" in DB
4. PreviewWorkspace shows start button again
