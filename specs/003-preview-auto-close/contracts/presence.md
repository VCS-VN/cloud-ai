# Contracts: Preview Auto-Close Feature

## Heartbeat API

### POST /api/projects/:projectId/presence/heartbeat

**Purpose**: Client sends heartbeat to indicate user is still viewing the project page.

**Authentication**: Required (Firebase session cookie)

**Path Parameters**:
- `projectId` (string, required): The project ID

**Request Body**:
```typescript
{
  userId: string;
}
```

**Response 200**:
```typescript
{
  success: true;
  nextHeartbeatMs: 30000;
}
```

**Response 401**:
```typescript
{
  error: "Unauthorized";
}
```

**Response 500**:
```typescript
{
  error: string;
}
```

---

## Start Preview Action

### Server Function (existing pattern)

Following the existing server function pattern in `/src/server/functions/`:

```typescript
type StartPreviewRequest = {
  data: {
    projectId: string;
  };
};

type StartPreviewResponse = {
  project: Project;
  devRuntime: DevRuntime;
};
```

---

## Presence Hook Contract

### useUserPresence Hook

```typescript
type UseUserPresenceOptions = {
  projectId: string;
  userId: string;
  enabled?: boolean;
};

type UseUserPresenceReturn = {
  isActive: boolean;
  lastHeartbeat: number | null;
};

// Behavior:
// - Returns isActive: true when tab is visible or focused
// - Returns isActive: false when tab is hidden for > 30s
// - Sends heartbeat every 30s when isActive: true
// - Cleans up on unmount
```

---

## Preview Initialization UI Contract

### PreviewInitPanel Props

```typescript
type PreviewInitPanelProps = {
  projectId: string;
  onStartPreview: () => void;
  isLoading?: boolean;
};

// States:
// 1. Idle (no preview running): Show "Start Preview" button
// 2. Loading (preview starting): Show spinner + "Initializing preview..."
// 3. Error (preview failed): Show error message + retry button
```

### Design Tokens (from DESIGN.md)

Following DESIGN.md tokens:
- Button: `button-secondary` pattern
- Surface: `var(--app-panel)`
- Text: `var(--app-text)`, `var(--app-icon-muted)`
- Border: `var(--app-border)`
- Control: `var(--app-control)`
- Spinner: `Loader2` icon with `animate-spin`
- Typography: `text-[14px]` body-sm style
- Transitions: `transition-colors duration-300`