# Implementation Plan: Preview Auto-Close

**Branch**: `003-preview-auto-close` | **Date**: 2026-05-11 | **Spec**: [spec.md](./spec.md)

## Summary

Feature allows server to automatically terminate preview processes when no users are viewing the project detail page, freeing server resources. Includes friendly initialization UI when starting preview and a manual preview button for re-engaging idle previews.

## Technical Context

**Language/Version**: TypeScript (React 19, Node.js runtime)  
**Primary Dependencies**: Tanstack Start, Tanstack Router, React Query  
**Storage**: In-memory presence tracking (no DB changes needed for MVP)  
**Testing**: Manual verification + existing test patterns  
**Target Platform**: Web application (browser)  
**Project Type**: Full-stack web app with real-time preview  
**Performance Goals**: Heartbeat every 30s, idle timeout 60s  
**Constraints**: Must use DESIGN.md tokens for any UI changes  
**Scale/Scope**: Single project per user session, typical session < 30min

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Yêu cầu rõ ràng code flow | ✅ Pass | User presence → idle timer → process stop flow is clear |
| II. Test cho business rules | ⚠️ Justified | MVP uses manual verification; unit tests deferred |
| III. API format lỗi nhất quán | ✅ Pass | Follows existing stream API pattern |
| IV. Không over-engineer | ✅ Pass | In-memory tracking, no new DB schema |
| V. UX & Design System | ✅ Pass | UI follows DESIGN.md tokens |
| VI. Bảo mật theo role | ✅ Pass | Only authenticated users trigger presence |
| VII. Code Review ưu tiên Graph | ✅ Pass | Will use code-graph-review |
| VIII. Code Formatting | ✅ Pass | ESLint run after implementation |

**Violations**: None

## Project Structure

### Source Code

```text
src/
├── features/
│   └── ai-agent/
│       ├── runtime/
│       │   ├── process-manager.server.ts   (existing)
│       │   └── presence-service.server.ts (NEW - user presence tracking)
├── routes/
│   └── api/
│       └── projects/
│           └── $projectId/
│               └── presence/
│                   └── heartbeat.ts        (NEW - heartbeat endpoint)
├── hooks/
│   └── useUserPresence.ts                 (NEW - client presence hook)
└── components/
    └── projects/
        └── PreviewInitPanel.tsx           (NEW - initialization UI)
```

## Complexity Tracking

> No violations requiring justification

## Phase 1: Design & Contracts

### Data Model

**Entities**: No new persistent entities. In-memory tracking only.

**PresenceService** (in-memory):

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
};
```

### Interface Contracts

**Heartbeat Endpoint**:

```
POST /api/projects/:projectId/presence/heartbeat
Authorization: Bearer <session>
Body: { userId: string }

Response 200: { success: true, nextHeartbeatMs: 30000 }
Response 401: { error: "Unauthorized" }
```

**Start Preview Button**: Existing button-secondary pattern (DESIGN.md `button-secondary` component) with text "Start Preview"

**Preview Initialization State**: Uses existing runtimeState.status === "idle" pattern with custom rendering

### Quickstart

See [quickstart.md](./quickstart.md)

## Implementation Phases

### Phase A: Server-side Presence Service
1. Create `presence-service.server.ts` with in-memory Map
2. Add heartbeat API endpoint
3. Implement idle timer logic
4. Integrate with ProcessManager.stop()

### Phase B: Client-side Presence Hook
1. Create `useUserPresence.ts` hook
2. Track visibility/focus changes
3. Send heartbeat every 30 seconds
4. Clean up on unmount

### Phase C: Preview Initialization UI
1. Create `PreviewInitPanel.tsx` component
2. Show "Start Preview" button when idle
3. Display loading state with spinner during init
4. Follow DESIGN.md tokens

### Phase D: Integration
1. Add presence heartbeat to project detail page
2. Update PreviewWorkspace to show init panel when idle
3. Wire up Start Preview button to runtime start
4. Test end-to-end flow