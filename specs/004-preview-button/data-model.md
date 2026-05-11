# Data Model: Manual Preview Button

## Existing entities — no schema changes required.

The `dev_runtime` JSON column in `project_states` already supports all needed fields:

```typescript
type DevRuntime = {
  status: "idle" | "installing" | "installed" | "starting" | "running" | "error" | "stopped";
  pid: number | null;
  port: number | null;
  installStartedAt: string | null;
  installCompletedAt: string | null;
  devStartedAt: string | null;
  previewUrl: string | null;
  installLog: string | null;
  devLog: string | null;
  lastError: string | null;
  lastErrorTier: "code" | "config" | "system" | null;
  retryCount: number;
  maxRetries: number;
  fixAttempts: Array<{
    attempt: number;
    changedFiles: string[];
    errorBefore: string;
    errorAfter: string | null;
    success: boolean;
  }>;
};
```

### State transitions for startPreview flow:

```
idle/stopped
    │
    ▼ (click Start Preview)
checking (ProcessManager.isRunning)
    │
    ├── process found → return { alreadyRunning: true }
    │
    └── no process → RuntimeService.runPostInitDev
            │
            ├── success → status: "running", previewUrl set
            │
            └── failure → status: "error", lastError set
```

### Validation rules:

- `status` must be one of the defined enum values
- `pid` is set when process starts, cleared when process stops
- `previewUrl` is populated only when `status === "running"`
- `lastError` and `lastErrorTier` are set only when `status === "error"`
- `retryCount` increments on each fix attempt, resets on successful start

### Relationships:

- `project_states.projectId` → `projects.id` (one-to-one via dev_runtime)
- `project_states.userId` → `users.id` (ownership check)
