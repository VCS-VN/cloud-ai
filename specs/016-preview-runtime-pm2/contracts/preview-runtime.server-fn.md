# Contract: Preview Runtime Server Functions

## getDevRuntimeState

Returns current project preview state for an authorized project user. Live status is reconciled from pm2 on every call.

**Input**

```ts
{ projectId: string }
```

**Success Response**

```ts
type DevRuntimeState = {
  status: "stopped" | "installing" | "installed" | "starting" | "running" | "fixing" | "error";
  enabled: boolean;
  previewUrl: string | null;
  previewHost: string | null;
  port: number | null;
  pid: number | null;
  installStatus: "idle" | "installing" | "installed" | "failed";
  dnsStatus: "none" | "creating" | "ready" | "delete_pending" | "error";
  lastError: string | null;
  lastErrorTier: "code" | "config" | "system" | null;
  retryCount: number;
  maxRetries: number;
  fixAttempts: Array<{ attempt: number; error: string; changedFiles: string[]; at: string }>;
  lastAccessedAt: string | null;
  operatorAttentionRequired: boolean;
  pm2: {
    status: "online" | "stopped" | "errored" | "launching" | "missing";
    restartCount: number;
    uptimeMs: number | null;
    memoryBytes: number | null;
  };
};
```

**Errors**

| Condition | Error |
|---|---|
| unauthenticated | `UNAUTHENTICATED` |
| project missing or unauthorized | `PROJECT_NOT_FOUND` |
| pm2 unavailable | status returned with `pm2.status="missing"`, `lastErrorTier="system"` where applicable |

## startPreview

Schedules or resumes preview runtime for an authorized project. In production, ensures DNS and preview access token state are ready.

**Input**

```ts
{ projectId: string }
```

**Success Response**

```ts
type StartPreviewResult =
  | { success: true; previewUrl: string; previewHost: string | null; port: number; alreadyRunning?: boolean }
  | { success: false; error: string; errorTier: "code" | "config" | "system"; operatorAttentionRequired?: boolean };
```

**Behavior**

- If currently running, return active preview URL.
- If install is needed, schedule background install then start.
- If production preview host is unset, return local loopback URL.
- If production preview host is set, ensure DNS record with up to 3 retries before startup is considered production-ready.
- Enforce concurrent preview cap before starting.

## refreshPreviewToken

Refreshes short-lived preview cookie for authorized project users.

**Input**

```ts
{ projectId: string }
```

**Success Response**

```ts
{ ok: true; expiresAt: string }
```

**Side Effects**

- Sets `preview_token` cookie scoped to `.myepis.cloud` in production.
- Local mode may no-op or set a localhost-only cookie for test parity.

## getPreviewLogs

Returns recent pm2 preview logs for an authorized project user.

**Input**

```ts
{ projectId: string; tail?: number }
```

**Success Response**

```ts
{ lines: string[]; truncated: boolean; source: "pm2" | "install" }
```

**Rules**

- `tail` defaults 200 and maxes 1000.
- Full logs remain file-based; DB stores only summaries.
