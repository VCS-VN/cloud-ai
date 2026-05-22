# Data Model: Production Preview Runtime with Project Isolation

## ProjectRuntimeIntent (stored in project state `devRuntime` JSON)

Represents desired and cached preview state for one project.

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `status` | enum | yes | `stopped`, `installing`, `installed`, `starting`, `running`, `fixing`, `error` |
| `enabled` | boolean | yes | Whether preview should be resumable. Defaults false until preview first scheduled. |
| `pid` | number|null | no | Cached supervisor pid; not source of truth. |
| `port` | number|null | no | Allocated port from 10000–19999. Stable until delete. |
| `previewUrl` | string|null | no | Local loopback URL or production HTTPS URL. |
| `previewHost` | string|null | no | Production hostname `<projectId>.preview.myepis.cloud`. |
| `cloudflareDnsRecordId` | string|null | no | Provider record id for delete/retry. |
| `dnsStatus` | enum | yes | `none`, `creating`, `ready`, `delete_pending`, `error`. |
| `installStatus` | enum | yes | `idle`, `installing`, `installed`, `failed`. |
| `installStartedAt` | iso string|null | no | For stuck install sweep. |
| `installCompletedAt` | iso string|null | no | Completion timestamp. |
| `installLog` | string|null | no | Truncated install summary/failure. |
| `devStartedAt` | iso string|null | no | Last preview start timestamp. |
| `lastAccessedAt` | iso string|null | no | Updated by router on valid traffic. |
| `lastError` | string|null | no | User/operator summary, not full logs. |
| `lastErrorTier` | enum|null | no | `code`, `config`, `system`. |
| `retryCount` | number | yes | Current repair attempt count. |
| `maxRetries` | number | yes | Defaults 3. |
| `fixAttempts` | array | yes | Repair history. |
| `operatorAttentionRequired` | boolean | yes | True after repeated DNS cleanup/create failures or unrecoverable cleanup drift. |

### Validation Rules

- `port` must be null or within 10000–19999.
- `previewHost` must be null in local mode and must match `<projectId>.preview.myepis.cloud` in production mode.
- `cloudflareDnsRecordId` is required when `dnsStatus=ready` in production.
- `enabled=false` projects must not be lazy-resumed.
- `operatorAttentionRequired=true` must surface in admin/operator logs and runtime state response.
- Database JSON fields must use PostgreSQL `json`, not `jsonb`.

### State Transitions

```text
stopped -> installing -> installed -> starting -> running
running -> stopped              (LRU/idle/manual stop)
running -> starting             (config/package restart)
starting -> fixing              (code/config startup error)
fixing -> starting              (repair attempt applied)
fixing -> error                 (max retries)
installing -> error             (install failed or stuck timeout)
any -> error                    (system failure)
any -> stopped                  (delete/teardown)
```

## PreviewProcess

Live process state derived from pm2.

| Field | Type | Notes |
|---|---:|---|
| `name` | string | `proj-<projectId>` |
| `pm2Status` | enum | `online`, `stopped`, `errored`, `launching`, `missing` |
| `pid` | number|null | Supervisor process id |
| `restartCount` | number | From pm2 metadata |
| `uptimeMs` | number|null | From pm2 metadata |
| `memoryBytes` | number|null | Used for diagnostics only |
| `outLogPath` | string|null | Tail source |
| `errorLogPath` | string|null | Tail source |

## PreviewDnsRecord

| Field | Type | Notes |
|---|---:|---|
| `projectId` | uuid/string | Project id |
| `hostname` | string | `<projectId>.preview.myepis.cloud` |
| `recordId` | string | Cloudflare DNS record id |
| `target` | string | `<tunnelId>.cfargotunnel.com` |
| `proxied` | boolean | true |
| `createdAt` | iso string | Audit |
| `lastError` | string|null | DNS failure summary |

## PreviewAccessToken

JWT claim shape issued only to authorized app users.

| Claim | Type | Notes |
|---|---:|---|
| `sub` | string | User id |
| `projectId` | string | Project id |
| `aud` | string | `preview` |
| `iss` | string | App issuer |
| `iat` | number | Issued at |
| `exp` | number | 15-minute expiry |
| `jti` | string | Optional token id for revocation/audit |

Cookie policy:

- Name: `preview_token`
- Domain: `.myepis.cloud` in production
- Secure: true in production
- HttpOnly: true
- SameSite: `Lax`

## RuntimeJob

In-memory/background job with persisted progress in `ProjectRuntimeIntent`.

| Job | Purpose | Persisted Outcome |
|---|---|---|
| install | Run dependency install | `installStatus`, `installLog`, timestamps |
| start | Start pm2 preview | `status`, `pid`, `previewUrl`, `lastError` |
| restart | Restart for config/package changes | `status`, `lastError` |
| repair | Attempt code/config fix | `fixAttempts`, `retryCount`, `status` |
| teardown | Delete pm2 process, DNS, port, workspace | soft-deleted row and cleanup metadata |
| reconcile | Repair boot-time drift | synced runtime status, operator attention flags |

## ProjectWorkspaceRoot

Path resolution:

```text
if PROJECTS_ROOT set -> path.resolve(PROJECTS_ROOT)
else if NODE_ENV=production -> /var/bin/projects
else -> path.resolve(process.cwd(), "projects")
```

All project file operations must verify resulting paths remain inside resolved root.
