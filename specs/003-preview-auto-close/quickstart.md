# Quickstart: Preview Auto-Close Feature

## Overview

This feature adds automatic preview process termination when no users are viewing a project, plus friendly initialization UI.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Browser)                        │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │ useUserPresence  │───▶│  visibility/focus tracking   │  │
│  │     hook         │    └──────────────────────────────┘  │
│  └────────┬────────┘                                     │
│           │ heartbeat every 30s                           │
└───────────┼───────────────────────────────────────────────┘
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Server (Node.js)                        │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │ presence-service │◀───│   heartbeat endpoint          │  │
│  │   .server.ts     │    └──────────────────────────────┘  │
│  └────────┬────────┘                                     │
│           │ check idle timeout                            │
│           ▼                                               │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │ ProcessManager   │───▶│  stop(projectId)              │  │
│  │                 │    └──────────────────────────────┘  │
│  └──────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `src/features/ai-agent/runtime/presence-service.server.ts` | In-memory user presence tracking |
| `src/routes/api/projects/$projectId/presence/heartbeat.ts` | Heartbeat API endpoint |
| `src/hooks/useUserPresence.ts` | Client presence hook |
| `src/components/projects/PreviewInitPanel.tsx` | Init UI component |

## New Dependencies

None (uses existing ProcessManager, SSE patterns)

## Configuration

- **Heartbeat interval**: 30 seconds (client)
- **Idle timeout**: 60 seconds (server)

## Testing

1. Open project detail page
2. Start preview (click Start Preview button)
3. Open browser DevTools → Network tab
4. Verify heartbeat requests every 30s
5. Close tab/switch away for 60s
6. Verify preview process terminates