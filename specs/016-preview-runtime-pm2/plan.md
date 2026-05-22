# Implementation Plan: Production Preview Runtime with Project Isolation

**Branch**: `016-preview-runtime-pm2` | **Date**: 2026-05-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-preview-runtime-pm2/spec.md`

## Summary

Rebuild the preview runtime so AI-generated retail storefronts install, start, and stay reachable on a production VPS. Replace the in-process `child_process.spawn` model with a pm2 supervisor for per-project dev servers, expose previews through Cloudflare Tunnel + per-project subdomains via an internal Host-based router with cookie-gated access tokens, decouple install/start from the AI message stream so UI state survives page reloads, derive live state from pm2 (DB only stores intent + cache), and move project workspaces to a configurable folder outside the deployed repository. Local development keeps a simpler loopback path: vite on `127.0.0.1:<port>`, no router, no Cloudflare.

## Technical Context

**Language/Version**: TypeScript on Node.js 20+ (TanStack Start runtime)  
**Primary Dependencies**: TanStack Start, TanStack Router, Drizzle ORM (PostgreSQL `json` columns), `pm2` programmatic API, `http-proxy` (Node), `axios`, `jsonwebtoken` (or @ts/jose) for preview tokens, Cloudflare REST API (DNS records).  
**Storage**: PostgreSQL via Drizzle. Reuses existing `project-states` `dev_runtime` JSON column; adds new columns for preview intent (port, host, dnsRecordId, lastAccessedAt) on the same row or sibling table; new `preview_tokens` schema already exists.  
**Testing**: Vitest for unit + integration; existing `__tests__` co-located. Mocks for pm2 daemon, http-proxy, Cloudflare API.  
**Target Platform**: Linux VPS (production) running pm2 + cloudflared (systemd, devops-managed). Local dev: macOS/Linux developer machines.  
**Project Type**: Web service (TanStack Start full-stack) with worker/runtime supervision layer.  
**Performance Goals**: P95 runtime state poll latency < 200 ms; lazy resume serves first byte < 30 s; HMR latency < 500 ms over Cloudflare Tunnel.  
**Constraints**: Single VPS, finite RAM (≥ 8 GB recommended). `MAX_CONCURRENT_PREVIEWS=8` default. Per-process memory restart 512 MB. Token TTL 15 min. Idle timeout 30 min. Lazy resume timeout 30 s. Port pool 10000–19999. Log retention 10 MB × 5 files (≈ 50 MB) per project.  
**Scale/Scope**: Hundreds of generated projects in DB, ≤ 8 running concurrently, single internal router instance.

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Clear code flow & feature spec | PASS | Layered modules: `pm2-driver`, `port-allocator`, `cloudflare-dns`, `preview-router`, `runtime-orchestrator`, `preview-token-service`. Service contracts unchanged externally. |
| II. Tests for business rules | PASS | Vitest for orchestrator state machine, port allocator, router auth, lazy-resume dedupe, reconciler. Mock pm2 + CF API. |
| III. Consistent API errors | PASS | Server fns reuse existing `StartPreviewResult` shape; errors carry `errorTier: code/config/system`. |
| IV. No over-engineer | PASS | Greenfield runtime layer replaces broken module; no new abstractions beyond what 28 FRs require. Reuses existing `ProjectStateStore`, `snapshot-service`, `agent-orchestrator`. |
| V. UX simple + DESIGN.md tokens | PASS | UI changes: poll-driven runtime states; reuses existing `PreviewToolbar`/`PreviewWorkspace` styling. No raw colors. |
| VI. Auth/role enforcement + env safety | PASS | Preview token issuance gated by project authorization (FR-010 clarification). App writes only `VITE_PORT`/`VITE_PREVIEW_HOST` into pm2 env (process env, not project `.env` file). Cloudflare creds in app env, not project. |
| VII. Code review graph-first | PASS | Plan-time only; review enforced at PR. |
| VIII. Format with ESLint | PASS | Run repo lint after edits. |
| IX. PostgreSQL `json` not `jsonb` | PASS | Reuses existing `dev_runtime` column (already `json`). New columns also use `json`. |
| X. Import alias `@/` and `@app/` | PASS | All new modules import via `@/...`. |

No violations. Complexity Tracking section omitted.

## Project Structure

### Documentation (this feature)

```text
specs/016-preview-runtime-pm2/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── preview-runtime.server-fn.md
│   ├── preview-router.http.md
│   └── preview-token.api.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── config/
│   │   └── paths.server.ts                       # NEW: getProjectsRoot helper
│   ├── services/
│   │   └── project-service.ts                    # CHANGED: thin wrappers calling runtime-orchestrator
│   └── functions/
│       ├── preview.ts                            # CHANGED: includes new fields, logs endpoint
│       └── preview-logs.ts                       # NEW: tail logs server fn
├── features/ai-agent/
│   ├── runtime/
│   │   ├── pm2-driver.server.ts                  # NEW: pm2.connect/start/stop/list/describe wrapper
│   │   ├── port-allocator.server.ts              # NEW: 10000-19999 pool, persist+release
│   │   ├── cloudflare-dns.server.ts              # NEW: REST CNAME create/delete with retry+backoff
│   │   ├── preview-router.server.ts              # NEW: Host-based proxy on 127.0.0.1:9000
│   │   ├── preview-token-service.server.ts       # NEW: JWT issue/verify/refresh on .myepis.cloud
│   │   ├── runtime-orchestrator.server.ts        # NEW: scheduleEnsureRunning, install→pm2.start, smart restart, repair
│   │   ├── runtime-reconciler.server.ts          # NEW: boot reconcile + sweep stuck installs
│   │   ├── runtime-events.ts                     # CHANGED: emit minimal stream events for agent UI
│   │   ├── error-analyzer.server.ts              # KEEP
│   │   └── README.md
│   ├── project/
│   │   ├── project-state.schema.ts               # CHANGED: extend DevRuntime with previewHost, dnsRecordId, lastAccessedAt, installStatus, installLog
│   │   └── project-state-store.server.ts         # CHANGED: typed accessors for new fields
│   └── agent/
│       └── agent-orchestrator.server.ts          # CHANGED: replace inline install/dev/fix with fire-and-forget runtime-orchestrator.scheduleEnsureRunning
├── routes/
│   └── api/
│       └── projects/$projectId/
│           ├── preview-logs.ts                   # NEW: GET tail logs (auth required)
│           └── preview-token-refresh.ts          # NEW: POST refresh access token
├── db/
│   └── migrations/
│       └── 0009_preview_intent.sql               # NEW: extend dev_runtime JSON shape (no schema break) + index on lastAccessedAt if needed
├── agent/
│   └── project-workspace-service.ts              # CHANGED: default to getProjectsRoot()
└── features/ai-agent/security/
    └── path-guard.server.ts                      # CHANGED: default to getProjectsRoot()

app/
└── routes/
    └── projects/$projectId.tsx                   # CHANGED: react-query refetchInterval polling, derive runtimeState from server only

projects/                                          # LOCAL ONLY default; production uses /var/bin/projects via PROJECTS_ROOT
```

**Structure Decision**: Single web-service project layout. Backend runtime layer concentrated under `src/features/ai-agent/runtime/*` and `src/server/config/`. UI surface lives in existing `src/routes/projects/$projectId.tsx`. No new top-level package needed.

## Phases

### Phase 0: Outline & Research

Research items collected and resolved in [research.md](./research.md):

- pm2 programmatic API: connect/start/describe/list/stop/delete, env injection, `max_memory_restart`, `autorestart`, log file paths, rotation strategy.
- Vite dev server config under reverse proxy with WSS HMR (clientPort 443, allowedHosts, host whitelist).
- Cloudflare DNS REST API: zone-scoped CNAME create/delete, response shape, idempotency, error retries.
- Internal HTTP/WS router design with `http-proxy` upgrade events and Host-based mapping.
- Preview JWT design (HS256, audience, projectId claim, parent-domain cookie, refresh).
- Reconciler heuristics for stuck installs and zombie pm2 entries.
- Workspace path resolution: `PROJECTS_ROOT` env with platform-aware defaults.

### Phase 1: Design & Contracts

Outputs:

- [data-model.md](./data-model.md): extends `DevRuntime` JSON, defines `PreviewToken` claim shape, lifecycle states.
- [contracts/](./contracts/): server function signatures, HTTP routes, router behavior, error contract.
- [quickstart.md](./quickstart.md): operator and developer setup.
- AGENTS.md SPECKIT marker updated to point at this plan.

## Notes

- Constitution gate re-check after Phase 1: still PASS (no new abstractions beyond planned modules; data model addition is additive JSON fields).
- Migration approach: in-place rewrite of runtime layer, keep DB schema additive. No breaking change to UI server fn signatures (`startPreview`, `getDevRuntimeState`).
