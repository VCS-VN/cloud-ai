# Feature Specification: Preview Auto-Close

**Feature Branch**: `003-preview-auto-close`
**Created**: 2026-05-11
**Status**: Draft
**Input**: User description: "server will auto close project process when no users in preview"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auto-close idle preview process (Priority: P1)

As a logged-in user viewing a project preview, I want the server to automatically stop the preview process when no users are viewing the project detail, so that server resources are freed.

**Why this priority**: Without this, preview processes accumulate and block server resources indefinitely.

**Independent Test**: Can be fully tested by having a user navigate to project detail, start preview, then leave the page and verify process terminates after timeout.

**Acceptance Scenarios**:

1. **Given** a user is viewing a project detail with active preview, **When** the user navigates away or loses focus for longer than the idle timeout, **Then** the server terminates the preview process for that project.

2. **Given** a preview process is running with no users viewing the project detail, **When** the idle timeout expires, **Then** the server automatically terminates the preview process.

---

### User Story 2 - Show preview initialization UI (Priority: P1)

As a project owner, I want to see a friendly UI when the preview is being initialized, so I understand the system is working and don't think it's frozen.

**Why this priority**: Without feedback, users may think the system is broken and refresh or take other actions that could cause issues.

**Independent Test**: Can be fully tested by clicking preview button and observing the loading state is displayed during initialization.

**Acceptance Scenarios**:

1. **Given** a project owner is on the project detail page with no active preview process, **When** they click the preview button, **Then** a friendly "Initializing preview..." UI is displayed.

2. **Given** the preview initialization is in progress, **When** it completes, **Then** the preview content replaces the loading UI.

---

### User Story 3 - Manual preview trigger (Priority: P2)

As a project owner, I want a preview button to appear when no preview process is running, so I can start a preview session manually.

**Why this priority**: Users need an explicit way to start previewing since the server won't auto-start when no process exists.

**Independent Test**: Can be fully tested by navigating to a project detail with no active preview and clicking the preview button.

**Acceptance Scenarios**:

1. **Given** a project owner is on the project detail page with no active preview process, **When** they click the preview button, **Then** the system starts the preview process and shows the initialization UI.

---

### Edge Cases

- What happens when a user loses focus briefly (less than timeout)? System should NOT terminate the process.
- How does the system handle multiple users viewing the same project preview? Process should only terminate when ALL users leave.
- What happens if the server terminates the process while a user is actively viewing? User should see an error or be prompted to restart.
- What if the preview button is clicked multiple times rapidly? Should debounce or show that initialization is already in progress.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST track user presence on the project detail page (active connection/focus).
- **FR-002**: System MUST terminate the preview process for a project when no users have been present for a configurable idle timeout period.
- **FR-003**: System MUST display a friendly "Initializing preview..." UI when a preview process is starting.
- **FR-004**: System MUST show a preview button on the project detail page when no preview process is running for that project.
- **FR-005**: Users MUST be able to manually start a preview session by clicking the preview button.
- **FR-006**: System MUST only terminate the preview process when ALL users have left the project detail page.
- **FR-007**: System SHOULD allow configurable idle timeout (default: 60 seconds).

### Key Entities *(include if feature involves data)*

- **Project**: The project being previewed, identified by project ID.
- **Preview Process**: The runtime process that generates preview content for a project.
- **User Session**: Represents a user's active connection to the project detail page, tracking presence and focus state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Preview processes are terminated within [timeout + 30 seconds] of last user leaving the project detail page.
- **SC-002**: Users see a friendly initialization UI immediately upon clicking the preview button, before the preview loads.
- **SC-003**: Server resource usage for idle preview processes is reduced to zero after implementation (no orphaned processes).
- **SC-004**: Preview button is visible and clickable within 1 second of page load when no preview process is active.

## Assumptions

- Users have stable internet connectivity.
- Preview processes are resource-intensive and should be stopped when not in use.
- The existing preview functionality will be extended rather than replaced.
- A single configurable idle timeout value applies to all projects (default 60 seconds).
- The system uses WebSocket or similar for real-time user presence tracking.