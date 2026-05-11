# Feature Specification: Axios HTTP Client Setup

**Feature Branch**: `006-axios-http-client`  
**Created**: 2026-05-12  
**Status**: Draft  
**Input**: User description: "Setup axios instance cùng interceptor cho project; sử dụng cho request HTTP của project detail; interceptor handle logic HTTP status code; có file .env chứa key field cho project."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Project Detail Requests Use Shared HTTP Client (Priority: P1)

As a logged-in project owner, I want project detail HTTP requests to use a consistent shared client so that requests include the required environment configuration and authentication behavior without each request redefining it.

**Why this priority**: This is the minimum usable slice because project detail currently has no HTTP request action and needs a reliable foundation before additional project operations are added.

**Independent Test**: Can be tested by triggering a project detail HTTP action and verifying it uses the shared request behavior, including configured base endpoint, default request expectations, and authenticated user context.

**Acceptance Scenarios**:

1. **Given** a logged-in project owner is viewing a project detail page, **When** a project detail HTTP action is triggered, **Then** the request is sent through the shared HTTP client configuration.
2. **Given** environment configuration is available, **When** a project detail request is sent, **Then** the request targets the configured backend service rather than a hardcoded endpoint.

---

### User Story 2 - HTTP Status Handling Is Consistent (Priority: P2)

As a logged-in project owner, I want failed project detail requests to produce consistent outcomes so that authentication issues, server failures, and general request errors are handled predictably.

**Why this priority**: Consistent error behavior prevents each feature from handling failures differently and reduces confusing user experiences when requests fail.

**Independent Test**: Can be tested by simulating common HTTP status outcomes for project detail requests and verifying the app responds with the expected authentication and error-handling behavior.

**Acceptance Scenarios**:

1. **Given** a project detail request receives an unauthorized response, **When** recovery is possible through the existing signed-in session, **Then** the request is retried once and the user remains signed in.
2. **Given** a project detail request receives an unauthorized response and recovery is not possible, **When** the failure is handled, **Then** the user's local authentication state is cleared and a clear session-expired outcome is available.
3. **Given** a project detail request receives a non-authentication error, **When** the failure is handled, **Then** the app exposes a consistent error message and status for the calling feature.

---

### User Story 3 - Environment Fields Are Centralized (Priority: P3)

As a project maintainer, I want project-level environment fields documented in a local environment file so that setup values for HTTP requests are discoverable and configurable per environment.

**Why this priority**: Centralizing setup fields reduces misconfiguration and makes new project initialization repeatable.

**Independent Test**: Can be tested by creating a fresh local setup and verifying required HTTP configuration fields are present and used by project detail requests.

**Acceptance Scenarios**:

1. **Given** a fresh local project setup, **When** the maintainer reviews environment configuration, **Then** the required HTTP request configuration fields are present with safe local defaults or placeholders.
2. **Given** the backend endpoint value changes between environments, **When** the app is started in that environment, **Then** project detail requests use the environment-specific value.

### Edge Cases

- If the backend endpoint is missing or empty, project detail requests fail with a clear configuration-related outcome instead of silently targeting an unintended service.
- If multiple requests fail due to an expired session at the same time, session recovery is attempted in a coordinated way and does not create duplicate recovery flows.
- If session recovery fails, stored authentication data is cleared so later requests do not repeatedly use invalid credentials.
- If an error response contains multiple possible message fields, the user-facing error outcome uses the clearest available message with a safe fallback.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide one shared HTTP request client for project detail actions.
- **FR-002**: System MUST use environment-provided backend configuration for project detail HTTP requests.
- **FR-003**: System MUST include authenticated user context on project detail HTTP requests when the user has a valid session.
- **FR-004**: System MUST apply consistent default request expectations for project detail HTTP calls, including JSON response handling and a bounded wait time.
- **FR-005**: System MUST transform failed HTTP outcomes into a consistent application error shape containing at least message and status information when available.
- **FR-006**: System MUST handle unauthorized responses by attempting session recovery at most once before retrying the original project detail request.
- **FR-007**: System MUST clear local authentication state when session recovery is unavailable or fails due to authorization.
- **FR-008**: System MUST avoid attempting session recovery for the session recovery request itself.
- **FR-009**: System MUST provide required environment fields for HTTP setup in a local environment file or documented local environment template.
- **FR-010**: System MUST keep preview project behavior outside this feature's scope.

### Key Entities

- **Project Detail Request**: A user-initiated or app-initiated HTTP operation related to a project detail page; includes target project context and authenticated user context when available.
- **Application Error**: A normalized failure outcome for request callers; includes a human-readable message, optional status, optional code, and optional original details.
- **Environment Configuration**: Local setup values that determine where project detail HTTP requests are sent and which fields are required for initialization.
- **Authentication Session**: The logged-in user's locally available access and recovery credentials used to authorize project detail requests.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of new project detail HTTP actions use the shared request behavior instead of defining separate request setup.
- **SC-002**: In validation scenarios, unauthorized project detail requests recover successfully when valid recovery credentials are available and retry no more than once.
- **SC-003**: In validation scenarios, unauthorized project detail requests clear local session state when recovery credentials are missing or invalid.
- **SC-004**: 95% of common request failure scenarios expose a clear, consistent message to the calling feature without requiring custom parsing.
- **SC-005**: A fresh local setup can identify all required HTTP configuration fields in under 2 minutes.

## Assumptions

- Users already have a working login flow and valid project ownership checks before reaching project detail.
- Project detail HTTP actions are the first consumer of this shared request setup.
- Session recovery uses the existing authentication model and does not introduce a new login method.
- Local environment fields may use placeholders or safe defaults where real service values are environment-specific.
- Preview project behavior is explicitly excluded from this feature.
