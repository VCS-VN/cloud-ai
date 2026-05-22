# Feature Specification: Production Preview Runtime with Project Isolation

**Feature Branch**: `016-preview-runtime-pm2`  
**Created**: 2026-05-21  
**Status**: Draft  
**Input**: User description: "Rebuild project preview runtime for AI-generated retail e-commerce storefronts so preview install/start state is visible in UI, runtime survives production deployment on a VPS, preview URLs work through per-project subdomains, and project workspaces live outside the deployed repository."


## Clarifications

### Session 2026-05-21

- Q: What preview log storage policy should production use? → A: Use supervisor log rotation at 10 MB × 5 files with an effective 50 MB per-project retention cap.
- Q: Who can access previews? → A: Only users authorized for the project in the main app can receive preview tokens.
- Q: What happens to a soft-deleted project subdomain? → A: DNS record is removed and the subdomain becomes reusable immediately, while the database row remains soft-deleted for audit.
- Q: What should happen when per-project DNS create/delete operations fail? → A: Retry DNS operations 3 times with backoff, then mark the project runtime or delete cleanup as needing operator attention.
- Q: Which operational defaults should be pinned for preview concurrency, token lifetime, idle cleanup, lazy resume, and per-process memory restart? → A: Accept current defaults: MAX_CONCURRENT_PREVIEWS=8, preview token TTL 15 minutes, idle timeout 30 minutes, lazy resume timeout 30 seconds, and per-process memory restart threshold 512 MB.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Preview Runtime Progress After Generation (Priority: P1)

A merchant or builder user initializes an AI-generated storefront and sees the preview move through installing, starting, running, fixing, or failed states without needing to keep the original AI message stream open.

**Why this priority**: The current preview appears invisible or stale after initialization even when the dev server starts successfully. Users need reliable feedback before they can evaluate generated storefronts.

**Independent Test**: Start a new project from an AI prompt, reload the project page during install, and verify the UI still shows current runtime progress until preview is available.

**Acceptance Scenarios**:

1. **Given** a newly generated storefront has finished code generation, **When** install begins in the background, **Then** the preview panel shows an installing state within 3 seconds.
2. **Given** the user reloads the project page while install or startup is in progress, **When** the page opens again, **Then** the preview panel resumes showing the current runtime state without restarting code generation.
3. **Given** the preview process becomes ready, **When** the user views the preview tab, **Then** the iframe loads the storefront and the toolbar shows a running state with the active preview URL.
4. **Given** install or startup fails, **When** the UI refreshes runtime state, **Then** the preview panel shows a failed state with a concise error summary and access to recent logs.

---

### User Story 2 - Use Production Preview URLs on VPS (Priority: P1)

A user opens a production preview URL for a generated storefront and reaches the correct project through a stable subdomain instead of a local-only URL.

**Why this priority**: `localhost` preview URLs do not work for remote users on production VPS deployments.

**Independent Test**: In a production-like environment with preview public host configured, start a project preview and open `<projectId>.preview.myepis.cloud` from a browser outside the VPS.

**Acceptance Scenarios**:

1. **Given** production preview is configured, **When** a project preview is created, **Then** the system creates or reuses one DNS record for `<projectId>.preview.myepis.cloud`.
2. **Given** the preview subdomain receives an HTTP request, **When** the project is running, **Then** the request is routed to the correct project preview.
3. **Given** the preview subdomain receives a websocket upgrade request, **When** the project is running, **Then** the connection reaches the same project preview so live updates continue working.
4. **Given** the application runs in local development without production preview host configuration, **When** a preview starts, **Then** the UI uses a local loopback URL and does not call external DNS or tunnel services.

---

### User Story 3 - Recover Accurate Runtime State After Restarts (Priority: P1)

An operator restarts or deploys the application, and users still see accurate preview state instead of stale running records.

**Why this priority**: The current runtime can record a running state even when the in-memory process map has been lost or the process has died.

**Independent Test**: Start a project preview, restart the application process, then reopen the project and verify the status matches the supervised process state.

**Acceptance Scenarios**:

1. **Given** a project preview was running before an application restart, **When** the application comes back online, **Then** runtime state is derived from the external process supervisor rather than old in-memory state.
2. **Given** a deleted project still has a leftover supervised process, **When** boot reconciliation runs, **Then** the leftover process is stopped and the deleted project remains inaccessible.
3. **Given** an install job was marked in progress before an application restart, **When** the job is older than the configured timeout, **Then** the project is marked failed with a recoverable error.
4. **Given** the application restarts, **When** no user requests a preview, **Then** the system does not eagerly start every enabled preview.

---

### User Story 4 - Protect Preview Access (Priority: P2)

A signed-in user can view previews they are allowed to access, while unauthenticated or unauthorized visitors cannot use guessed preview subdomains.

**Why this priority**: Storefront previews can contain merchant product data and must not become public merely because a subdomain exists.

**Independent Test**: Open a preview subdomain with and without a valid preview access cookie and verify only authorized access is proxied.

**Acceptance Scenarios**:

1. **Given** an authorized user opens a project page in the main app, **When** the preview iframe loads, **Then** the user receives a short-lived preview access token usable by the preview subdomain.
2. **Given** a request lacks a valid preview access token, **When** it reaches the preview router, **Then** the router denies access and does not proxy the request to the project.
3. **Given** a websocket upgrade request lacks a valid token, **When** it reaches the preview router, **Then** the router denies the upgrade.
4. **Given** an authorized token expires while the user is active in the editor, **When** the editor refreshes preview access, **Then** preview access continues without requiring code regeneration or process restart.

---

### User Story 5 - Keep VPS Resource Usage Bounded (Priority: P2)

An operator can run previews on a finite VPS without unbounded memory growth from many projects.

**Why this priority**: Each preview consumes resources; without limits, many generated projects can exhaust VPS memory.

**Independent Test**: Configure a low concurrent preview limit, open more previews than the limit, and verify older previews are stopped and later resume on demand.

**Acceptance Scenarios**:

1. **Given** the number of running previews reaches the configured limit, **When** another preview is started, **Then** the least recently accessed preview is stopped before the new one becomes available.
2. **Given** a stopped but enabled preview receives a subdomain request, **When** resources are available, **Then** the system starts it and serves the request within the startup timeout.
3. **Given** a preview process exceeds its per-process memory limit, **When** the supervisor restarts it, **Then** the UI reflects the current recovered or failed state on the next poll.
4. **Given** no request reaches a running preview for the configured idle interval, **When** resource cleanup runs, **Then** that preview becomes eligible for stopping.

---

### User Story 6 - Store Project Workspaces Outside Deploy Directory (Priority: P2)

An operator deploys the app repeatedly without losing generated project workspaces or filling the repository directory with user data.

**Why this priority**: Production workspaces must survive app deploys and live in a configured persistent folder.

**Independent Test**: Set or omit the projects root environment variable in local and production-like modes and verify new workspaces are created in the expected root.

**Acceptance Scenarios**:

1. **Given** `PROJECTS_ROOT` is set, **When** a project workspace is created, **Then** all project files are written under that configured root.
2. **Given** `PROJECTS_ROOT` is unset in local development, **When** a project workspace is created, **Then** it is written under the repository-local `projects` folder.
3. **Given** `PROJECTS_ROOT` is unset in production, **When** a project workspace is created, **Then** it is written under `/var/bin/projects`.
4. **Given** a project is deleted, **When** deletion completes, **Then** its workspace folder is removed while the database row remains soft-deleted.

---

### Edge Cases

- DNS record create or delete operations fail repeatedly: the system retries 3 times with backoff, records operator attention required, and does not silently hide the cleanup or startup problem.
- DNS record creation succeeds but process startup fails: project remains in an error state, the DNS record is retained for retry, and the UI shows a recoverable error.
- DNS record deletion fails during project deletion: project is still soft-deleted, preview access is denied, and the failure is logged for operator cleanup.
- A preview subdomain request arrives for an unknown, deleted, or unauthorized project: the router denies the request and does not start any process.
- Multiple requests arrive simultaneously for a stopped preview: only one startup attempt runs, and all requests wait for the same outcome or receive the same timeout failure.
- The selected port is already occupied by a non-project process: the allocator does not use that port and records a system error if no suitable port can be found.
- The preview process starts but never becomes healthy: startup fails after 30 seconds and the UI shows a failure state with recent logs.
- The application starts while external process supervisor data and database intent disagree: reconciliation resolves stale processes and deleted projects without eagerly starting all enabled previews.
- Production preview host is not configured: the system stays in local preview mode and must not call Cloudflare APIs.
- Preview access token expires during websocket use: new unauthorized requests are denied, while the editor can refresh access for active authorized users.
- Project path input attempts traversal outside the projects root: the workspace operation is rejected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST start preview runtime work independently from the AI message stream after storefront code generation completes.
- **FR-002**: The system MUST persist enough runtime intent and progress for the UI to display install, start, running, fixing, stopped, and error states after page reloads.
- **FR-003**: The system MUST expose a runtime state query that reflects the external supervised process state as the source of truth for live preview status.
- **FR-004**: The UI MUST poll runtime state while the preview tab is active and reduce polling frequency after the preview is stable.
- **FR-005**: The system MUST support local preview mode without Cloudflare Tunnel, external DNS changes, or host-based router requirements.
- **FR-006**: The system MUST support production preview mode where each project has a DNS name formatted as `<projectId>.preview.myepis.cloud`.
- **FR-007**: The system MUST create and delete per-project DNS records for production previews through the configured DNS provider API.
- **FR-008**: The system MUST route production preview HTTP and websocket traffic by subdomain host to the correct running project.
- **FR-009**: The system MUST deny preview HTTP and websocket traffic unless a valid preview access token is present.
- **FR-010**: The system MUST issue short-lived preview access tokens only to users authorized for the project when they open a project preview in the main app.
- **FR-011**: The system MUST allocate preview ports from the inclusive range 10000 through 19999 and persist the selected port for each project.
- **FR-012**: The system MUST avoid using ports already assigned to other active projects or occupied by non-project processes.
- **FR-013**: The system MUST release a project's allocated port when the project is deleted.
- **FR-014**: The system MUST start project preview processes under an external process supervisor with stable project-specific names.
- **FR-015**: The system MUST cap the number of concurrently running preview processes and stop least-recently-accessed previews when the cap is exceeded.
- **FR-016**: The system MUST lazily resume an enabled stopped preview when its production subdomain receives a valid request.
- **FR-017**: The system MUST wait up to 30 seconds for a lazily resumed preview to become ready before returning a startup failure.
- **FR-018**: The system MUST run dependency installation as a background job that records progress and errors separately from the supervised preview process.
- **FR-019**: The system MUST restart or reinstall previews only when changed files require it; ordinary source changes should rely on live reload behavior.
- **FR-020**: The system MUST run background repair attempts for code or configuration startup failures and record up to 3 attempts.
- **FR-021**: The system MUST provide access to recent preview logs without storing full process logs in primary project state, with log rotation at 10 MB × 5 files and an effective 50 MB per-project retention cap.
- **FR-022**: The system MUST reconcile runtime state on application boot without eagerly starting all enabled previews.
- **FR-023**: The system MUST fully tear down a deleted project preview by stopping its supervised process, deleting its DNS record, releasing its port, and removing its workspace folder while preserving a soft-deleted database record.
- **FR-024**: The system MUST support configurable project workspace storage through `PROJECTS_ROOT`.
- **FR-025**: The system MUST default project workspace storage to repository-local `projects` in local development when `PROJECTS_ROOT` is unset.
- **FR-026**: The system MUST default project workspace storage to `/var/bin/projects` in production when `PROJECTS_ROOT` is unset.
- **FR-027**: The system MUST ensure all workspace file operations remain within the resolved projects root.
- **FR-028**: The system MUST keep production preview DNS and tunnel usage disabled when production preview host configuration is absent.
- **FR-029**: The system MUST retry preview DNS create and delete operations 3 times with backoff before marking the project runtime or cleanup as requiring operator attention.
- **FR-030**: The system MUST make a soft-deleted project subdomain reusable immediately after successful DNS teardown while preserving the soft-deleted database row for audit.

### Key Entities

- **Project Runtime Intent**: Persistent desired preview configuration for a project, including enabled state, port, preview host, DNS record identifier, install state, last error, last accessed time, and repair attempts.
- **Preview Process**: Supervised per-project runtime that serves one generated storefront from its workspace and reports live process state through the supervisor.
- **Preview DNS Record**: Per-project public hostname record that maps a preview subdomain to the configured production tunnel target.
- **Preview Access Token**: Short-lived authorization credential allowing a user's browser to access a specific project preview through the preview subdomain.
- **Project Workspace Root**: Environment-controlled base directory where generated project folders are stored outside the deployed app directory in production.
- **Runtime Job**: Background operation that performs install, startup, restart, repair, or teardown while writing user-visible progress to persistent state.
- **Preview Router**: Production request entry point that validates access, maps hostnames to projects, resumes stopped previews when needed, and proxies HTTP/websocket traffic.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of project pages opened during install or startup show the correct current runtime state within 3 seconds.
- **SC-002**: A project preview remains reachable through its production subdomain after an application restart without requiring manual operator intervention.
- **SC-003**: 100% of local development preview starts avoid external DNS or tunnel calls when production preview host configuration is absent.
- **SC-004**: 100% of unauthorized preview subdomain requests are denied before reaching the generated project runtime.
- **SC-005**: When a stopped enabled preview receives a valid production request, 90% of successful resumes serve the first page within 30 seconds.
- **SC-006**: Running previews never exceed the configured concurrent preview limit during normal start and lazy-resume flows.
- **SC-007**: No generated project workspace is created inside the deployed repository in production when `PROJECTS_ROOT` is unset.
- **SC-008**: Deleting a project removes its public preview access, releases its runtime resources, and preserves its soft-deleted record in one user action.
- **SC-009**: Preview state after app boot has no stale running status for processes that the external supervisor reports as missing or stopped.
- **SC-010**: Recent preview logs for a failed runtime are available to the user or operator within 5 seconds of the failure being detected.
- **SC-011**: A successfully deleted project frees its preview subdomain for reuse immediately while retaining its soft-deleted audit record.

## Assumptions

- Production preview mode is enabled only when production preview host configuration is present; otherwise the system behaves as local development preview.
- Cloudflare Tunnel itself is provisioned and supervised outside the app by operations, with a catch-all ingress targeting the app's internal preview router on `127.0.0.1:9000`.
- The app manages per-project DNS records through Cloudflare API credentials supplied by environment variables.
- The preview public host is `preview.myepis.cloud`, producing project hosts like `<projectId>.preview.myepis.cloud`.
- Default preview port pool is 10000 through 19999.
- Default per-process memory restart threshold is 512 MB.
- Default preview log retention is 10 MB × 5 rotated files, capped at 50 MB per project.
- Default concurrent preview limit is 8 unless changed by configuration.
- Default lazy resume timeout is 30 seconds.
- Default preview token lifetime is 15 minutes and can be refreshed while an authorized user remains active in the editor.
- Preview access token issuance is limited to users already authorized for the project in the main app.
- Default idle timeout for cleanup eligibility is 30 minutes without preview traffic.
- Production default projects root is `/var/bin/projects` when `PROJECTS_ROOT` is unset.
- Local default projects root is repository-local `projects` when `PROJECTS_ROOT` is unset.
