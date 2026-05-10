# Research: Preview Auto-Close Feature

## Decision: User Presence Tracking Approach

**Chosen approach**: Client-side visibility/focus tracking with server-side heartbeat

### Rationale

The feature requires detecting when users leave the project detail page. The most reliable approach:

1. **Visibility API** - detects tab/window visibility changes
2. **Focus/blur events** - detects when user focuses away from the page
3. **Heartbeat mechanism** - periodic pings to server to indicate active presence

This is simpler than WebSocket and sufficient for the use case. SSE is already used in this codebase for streaming.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| WebSocket | Overkill for presence-only; adds complexity |
| Server-Sent Events | Already used for message streaming, but not ideal for presence (requires persistent connection management) |
| Database-backed sessions | Too slow for real-time presence; in-memory is sufficient |

---

## Decision: Preview Process Auto-Close Mechanism

**Chosen approach**: In-memory user count per project with idle timeout timer

### Rationale

1. Server maintains `Map<projectId, Set<userId>>` for active users per project
2. Each user sends periodic heartbeat (every 30 seconds)
3. Server tracks last heartbeat time per user
4. When all users leave (Set empty) → start idle timer (60 seconds)
5. When idle timer expires → call `processManager.stop(projectId)`
6. If user returns before timer expires → cancel timer

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Terminate immediately on user leave | Too aggressive; user may return |
| Database-backed user tracking | Too slow; in-memory is sufficient for this scale |
| Permanent user tracking | Resource-intensive; timeout-based is better |

---

## Decision: Preview Initialization UI

**Chosen approach**: Status-based UI following existing patterns

Based on DESIGN.md and existing codebase patterns:

1. When `runtimeState.status === "idle"` and no preview URL:
   - Show "Start Preview" button (using `button-secondary` style)
2. When user clicks Start Preview:
   - Show loading state with spinner and "Initializing preview..." text
3. When status changes to "starting" → "running":
   - Transition to iframe preview

### Design System Compliance

- Use `var(--app-panel)` for surfaces
- Use `var(--app-text)`, `var(--app-icon-muted)` for text
- Use `var(--app-border)` for borders
- Use `var(--app-control)` for interactive surfaces
- Typography: `text-[14px]` following body-sm style
- Transitions: `transition-colors duration-300`
- Spinner: `animate-spin` with `Loader2` icon

---

## Entities

### UserPresence (client-side)
```typescript
{
  userId: string;
  projectId: string;
  lastHeartbeat: number; // timestamp
}
```

### ProjectPresence (server-side)
```typescript
{
  projectId: string;
  users: Map<string, number>; // userId -> lastHeartbeatMs
  idleTimerId?: NodeJS.Timeout;
}
```

---

## Implementation Notes

1. **Heartbeat interval**: 30 seconds (client sends heartbeat every 30s)
2. **Idle timeout**: 60 seconds (server waits 60s after last user leaves)
3. **Heartbeat endpoint**: `/api/projects/:projectId/presence/heartbeat` (POST)
4. **Presence cleanup**: Timer cancelled when heartbeat received before expiry
5. **Process manager integration**: Existing `processManager.stop(projectId)` will be used
6. **Status tracking**: Follow existing `runtimeState.status` pattern