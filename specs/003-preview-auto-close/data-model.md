# Data Model: Preview Auto-Close Feature

## Overview

No persistent database entities required for MVP. Feature uses in-memory tracking only.

## In-Memory Structures

### PresenceService

```typescript
type UserPresence = {
  userId: string;
  projectId: string;
  lastHeartbeatMs: number;
};

type ProjectPresence = {
  projectId: string;
  users: Map<string, number>; // userId -> lastHeartbeatMs
  idleTimerId?: ReturnType<typeof setTimeout>;
  idleTimeoutMs: number;
};
```

### ProcessManager (existing)

```typescript
// Already exists at src/features/ai-agent/runtime/process-manager.server.ts
type DevProcessHandle = {
  projectId: string;
  pid: number;
  kill: () => void;
};

// Methods used:
// - stop(projectId: string): Promise<void>
// - isRunning(projectId: string): boolean
```

### RuntimeState (existing, extended)

```typescript
// Already exists in agent-event-reducer.ts
type RuntimeUIState = {
  status: "idle" | "installing" | "installed" | "starting" | "running" | "error" | "fixing";
  previewUrl?: string;
  previewPort?: number;
  error?: string;
  errorTier?: string;
  fixAttempt?: number;
  fixChangedFiles?: string[];
  durationMs?: number;
};
```

## State Transitions

### Presence State

```
User visits project page
    │
    ▼
User added to ProjectPresence.users
    │
    ▼
User sends heartbeat ────────────────────▶ (if tab visible)
    │
    │ (tab hidden / navigated away)
    ▼
No heartbeat for 60s
    │
    ▼
User removed from ProjectPresence.users
    │
    ▼
If users Map empty → start idleTimer (60s)
    │
    ▼
If user returns before timer expires → cancel timer
    │
    ▼
Timer expires → ProcessManager.stop(projectId)
```

## No Database Changes

This feature does not modify any database schema. All presence tracking is in-memory only.