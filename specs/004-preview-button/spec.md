# Feature Specification: Manual Preview Button for Inactive Projects

**Feature Branch**: `004-preview-button`  
**Created**: 2026-05-11  
**Status**: Draft  
**Input**: User description: "Button preview cho project khi không có preview process đang có trong project."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start Preview from Project Detail (Priority: P1)

User views a project detail page where no preview dev server process is currently running. User clicks the preview button, the system starts the dev server, and the preview UI loads automatically showing the running project.

**Why this priority**: This is the core feature — enabling users to proactively start a preview for any project that doesn't already have a running process.

**Independent Test**: Can be fully tested by navigating to a project without an active preview, clicking the preview button, and verifying the preview UI loads with the running project.

**Acceptance Scenarios**:

1. **Given** user is on a project detail page with no active preview process, **When** user clicks the preview button, **Then** the system starts the dev server and auto-loads the preview UI.
2. **Given** user is on a project detail page with no active preview process, **When** user clicks the preview button, **Then** the system checks for existing processes before starting a new one to avoid duplicate servers.
3. **Given** user clicks the preview button, **When** the dev server starts successfully, **Then** the preview UI automatically displays the running project.

---

### User Story 2 - Auto-Open Preview When Process Already Exists (Priority: P2)

User views a project detail page where a preview dev server process is already running (e.g., from a previous session or another user action). The system detects the existing process and automatically opens the preview UI without requiring the user to click a button.

**Why this priority**: Provides seamless UX when a process is already available, avoiding confusion about why no button is shown or why the button behaves differently.

**Independent Test**: Can be fully tested by having an active dev server process for a project, navigating to its detail page, and verifying the preview UI opens automatically.

**Acceptance Scenarios**:

1. **Given** a dev server process is already running for the project, **When** user navigates to the project detail page, **Then** the preview UI loads automatically without requiring button interaction.
2. **Given** a dev server process is already running for the project, **When** user navigates to the project detail page, **Then** no start-preview button is shown since the preview is already available.

---

### User Story 3 - Preview Button Visibility Based on Process State (Priority: P3)

User views a project detail page. The system evaluates whether a preview dev server process exists for this project and shows or hides the preview button accordingly.

**Why this priority**: Ensures the button only appears when needed, keeping the UI clean and preventing users from starting duplicate processes.

**Independent Test**: Can be fully tested by toggling the process state of a project and verifying the button visibility matches the expected state.

**Acceptance Scenarios**:

1. **Given** no dev server process exists for the project, **When** user views the project detail page, **Then** a preview button is displayed.
2. **Given** a dev server process already exists for the project, **When** user views the project detail page, **Then** no preview button is displayed and the preview is accessible directly.

---

### Edge Cases

- **Process start failure**: If the dev server fails to start (e.g., port conflict, missing files, build error), the user sees a clear error message and the preview button remains available for retry.
- **Concurrent button clicks**: If the user clicks the preview button multiple times rapidly, the system ensures only one dev server process is started.
- **Process exists but preview is unreachable**: If a process is detected but the preview UI cannot connect to it, the system attempts to restart the process and informs the user.
- **Project without valid previewable content**: If the project has no files that can be served by a dev server, the user receives an informative error message rather than a silent failure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a preview button on the project detail page when no dev server process is running for that project.
- **FR-002**: System MUST check for the existence of a running dev server process before attempting to start a new one when the preview button is clicked.
- **FR-003**: System MUST start the dev server process for the project when the user clicks the preview button and no existing process is found.
- **FR-004**: System MUST automatically load the preview UI once the dev server starts successfully.
- **FR-005**: System MUST automatically open the preview UI when navigating to a project detail page if a dev server process is already running.
- **FR-006**: System MUST hide the preview button when a dev server process is already running for the project.
- **FR-007**: System MUST provide user feedback (loading state, success, or error) during the preview start process.
- **FR-008**: System MUST handle preview start failures gracefully by displaying an error message and keeping the preview button available for retry.
- **FR-009**: System MUST prevent duplicate dev server processes from being started for the same project.
- **FR-010**: System MUST verify the user owns the project before allowing them to start a preview.

### Key Entities

- **Project**: Represents a user's project with associated files and configuration. Has a state indicating whether a dev server process is currently running.
- **Preview Process**: A running dev server instance associated with a specific project. Has a lifecycle state (starting, running, failed, stopped).
- **Preview UI**: The visual interface that displays the rendered output of a project's dev server.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can start a project preview and see the preview UI within 10 seconds of clicking the button.
- **SC-002**: 95% of preview start attempts succeed on the first try without requiring a retry.
- **SC-003**: No duplicate dev server processes are created for the same project, verified by process count monitoring.
- **SC-004**: Users can successfully view the preview of any project they own that has valid previewable content.
- **SC-005**: When a preview process already exists, the preview UI loads automatically within 5 seconds of navigating to the project detail page.

## Assumptions

- Users have stable internet connectivity and access to the platform.
- The project has already been processed by the agentic system and contains valid previewable files.
- The existing dev server infrastructure can be reused for manual preview starts.
- Process state can be reliably detected and queried by the frontend.
- Only the project owner can start a preview for their project.
- Preview auto-close behavior when navigating away from the project detail page is out of scope for this feature.
- Code editing functionality and agentic tool calling modifications are out of scope.
