# Interface Contracts: Manual Preview Button

## Server Function Contracts

### `getDevRuntimeState` (GET)

**Endpoint**: Server function via `@tanstack/react-start`
**Authentication**: Required (`requireServerUser()`)
**Authorization**: User must own the project

**Input**:
```typescript
{
  projectId: string;
}
```

**Success Response** (200):
```typescript
{
  status: "idle" | "installing" | "installed" | "starting" | "running" | "error" | "stopped";
  pid: number | null;
  port: number | null;
  previewUrl: string | null;
  lastError: string | null;
  lastErrorTier: "code" | "config" | "system" | null;
  retryCount: number;
  // ... other DevRuntime fields
}
```

**Error Response** (404):
```typescript
{
  error: "Project not found";
}
```

**Error Response** (403):
```typescript
{
  error: "Unauthorized";
}
```

---

### `startPreview` (POST)

**Endpoint**: Server function via `@tanstack/react-start`
**Authentication**: Required (`requireServerUser()`)
**Authorization**: User must own the project

**Input**:
```typescript
{
  projectId: string;
}
```

**Success Response** (200):
```typescript
{
  success: true;
  previewUrl: string;
  port: number;
}
```

**Already Running Response** (200):
```typescript
{
  success: true;
  alreadyRunning: true;
  previewUrl: string;
  port: number;
}
```

**Error Response** (200):
```typescript
{
  success: false;
  error: string;
  errorTier: "code" | "config" | "system";
}
```

**Error Response** (404):
```typescript
{
  error: "Project not found";
}
```

**Error Response** (403):
```typescript
{
  error: "Unauthorized";
}
```

---

## Component Contracts

### `PreviewInitPanel` Props

```typescript
type PreviewInitPanelProps = {
  projectId: string;
  onStartPreview: () => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};
```

**Behavior**:
- Shows "Start Preview" button when `isLoading === false` and `error === null`
- Shows loading spinner when `isLoading === true`
- Shows error message with retry button when `error !== null`
- Button uses DESIGN.md `button-primary` style: pill shape, black bg, white text
- Prevents double-clicks via `isStarting` local state

### `PreviewWorkspace` Integration

```typescript
// In $projectId.tsx
const showIframe = runtimeState.status === "running" && runtimeState.previewUrl;
const showInitPanel = runtimeState.status === "idle" && !runtimeState.previewUrl;
```

**Behavior**:
- Shows iframe when `showIframe === true`
- Shows `PreviewInitPanel` when `showInitPanel === true`
- Shows `FilePreviewPanel` for other states

### `PreviewToolbar` Integration

```typescript
// External link button in toolbar
{previewUrl ? (
  <a href={previewUrl} target="_blank" rel="noopener noreferrer">
    <ExternalLink />
  </a>
) : (
  <button type="button" aria-label="Open preview">
    <ExternalLink />
  </button>
)}
```

**Behavior**:
- External link button opens preview in new tab when `previewUrl` exists
- Disabled button shown when no preview is running
