# Research: Production Preview Runtime with Project Isolation

## Decision: Use pm2 programmatic API as live process source of truth

**Rationale**: The current runtime stores process handles in memory, so app restarts lose process knowledge while DB may still say running. pm2 keeps process state outside the app process, supports stable process names, env injection, memory restart, and log files. `pm2.describe(name)` becomes the live status path; DB stores only intent/cache.

**Alternatives considered**:

- `child_process.spawn`: rejected because process lifecycle dies with app and cannot survive deploys.
- pm2 CLI spawn: rejected because every operation would require shelling out and parsing output; API is safer for a service integration.
- Docker per project: rejected as over-scope for one VPS and current pm2 goal.

## Decision: Cloudflare Tunnel is production-only and devops-managed by systemd

**Rationale**: Local preview must work without Cloudflare credentials or a tunnel process. In production, ops owns `cloudflared` as a system service with static catch-all ingress to `127.0.0.1:9000`; the app only manages per-project DNS records through Cloudflare API.

**Alternatives considered**:

- App starts/restarts cloudflared: rejected because tunnel supervision is ops concern and systemd is more appropriate for a host-level service.
- Per-project tunnel: rejected due to process overhead and scaling complexity.
- Local tunnel mode: rejected because it increases developer setup burden and is unnecessary for local iframe preview.

## Decision: One internal preview router handles all production subdomains

**Rationale**: A catch-all Cloudflare Tunnel can route all preview hosts to one app-owned router on `127.0.0.1:9000`. The router validates tokens, maps `Host` to project, lazy-resumes stopped previews, and proxies HTTP/WebSocket to the allocated port. This avoids reloading cloudflared when projects are created/deleted.

**Alternatives considered**:

- Per-project cloudflared ingress entries: rejected because every project change would require tunnel config mutation and reload.
- Expose vite ports directly: rejected for security and TLS/port management issues.
- Separate router process: rejected for v1; same app process can share DB/auth services and pm2 driver.

## Decision: Allocate stable ports from 10000–19999

**Rationale**: The router needs a stable upstream for each project. A persisted port from a bounded pool allows repeatable pm2 restarts, health checks, and cleanup. The allocator checks existing assignments and local socket availability before assigning.

**Alternatives considered**:

- Let Vite auto-select ports: rejected because port is unknown until startup logs and can race under concurrent starts.
- Hash projectId to port: rejected because collisions are possible and hard to remediate.
- Unix sockets: rejected because Vite dev server is TCP-oriented.

## Decision: Vite config reads runtime env for port and public preview host

**Rationale**: Generated project templates can read `VITE_PORT` and `VITE_PREVIEW_HOST` without rewriting `vite.config.ts` per project. Production uses `host: 127.0.0.1`, strict port, WSS HMR on public host port 443, and allowed host whitelist. Local mode omits public host and uses loopback URL directly.

**Alternatives considered**:

- Rewrite Vite config after project creation: rejected because AST/string patching is brittle.
- CLI flags only: rejected because CLI covers port/host but not HMR host and allowedHosts.
- Disable HMR: rejected because preview should update live after generated source edits.

## Decision: Install is a background one-shot job, not a pm2 process

**Rationale**: Dependency install is finite work with progress/error state, not a long-running process. The app runs install in a background job, records install status/log summary, and then starts pm2 preview when installation succeeds. If the app restarts during install, a timeout marks the job failed and retryable.

**Alternatives considered**:

- pm2 one-shot install app: rejected because stopped/exited one-shot jobs confuse runtime state.
- Keep install inside AI stream: rejected because UI state disappears after stream closes/reload.

## Decision: UI uses polling for runtime state

**Rationale**: pm2 is the query-time source of truth. Client polling every 2–3 seconds during active preview mode is simpler than a new runtime SSE stream and survives reloads. Polling can slow once preview is stable.

**Alternatives considered**:

- Runtime SSE stream: rejected because backend would still poll pm2 unless event bus is adopted.
- Manual refresh only: rejected because install/start progress would stay invisible.

## Decision: Preview access uses project-scoped short-lived tokens

**Rationale**: Preview subdomains sit outside the app origin. A signed token in a parent-domain cookie lets iframe and new-tab previews authorize HTTP and WS upgrade requests while preserving access control. Tokens are issued only to users authorized for the project and refreshed while the editor stays open.

**Alternatives considered**:

- Public previews: rejected due to private merchant data exposure.
- Query token: rejected because URLs leak through logs/referrers.
- Cloudflare Access: rejected for v1 because identity would be separate from app project permissions.

## Decision: LRU resource cap with lazy resume

**Rationale**: A VPS can only run a limited number of Vite dev servers. `MAX_CONCURRENT_PREVIEWS=8` is a safe default for an 8GB VPS with 512MB process restart limit. The router records last access and can stop least-recently-used previews, then lazy-resume on the next valid request.

**Alternatives considered**:

- No cap: rejected because total memory can exceed VPS capacity.
- Only manual start: rejected because the feature requires auto preview after generation and transparent resume.

## Decision: Production workspaces default to `/var/bin/projects`

**Rationale**: User-generated project files and dependencies must live outside the deployed repository to survive deploys and avoid mixing user data with source. `PROJECTS_ROOT` overrides all modes; local default remains repo-local `projects` for developer convenience; production default is `/var/bin/projects` per user request.

**Alternatives considered**:

- Always require `PROJECTS_ROOT`: rejected for local onboarding friction.
- Use `/var/lib/myepis/projects`: noted as more conventional, but user explicitly selected `/var/bin/projects`.
