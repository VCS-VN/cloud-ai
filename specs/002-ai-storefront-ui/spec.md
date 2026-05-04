# Feature Specification: AI Storefront UI

**Feature Branch**: `002-ai-storefront-ui`  
**Created**: 2026-05-04  
**Status**: Draft  
**Input**: User description: "UI nền tảng cho AI Storefront Builder: Home prompt, Projects workspace, project messages, virtual file/folder explorer, and PWA-capable storefront output."

## Clarifications

### Session 2026-05-04

- Q: Should the builder UI migrate to a proper TanStack Start structure now or keep the current Vite-style scaffold for MVP? → A: Migrate the builder UI to a proper TanStack Start structure now, then implement routes there.
- Q: Should the MVP use client-only mock data, the existing service boundary with fallback data, or real database persistence for project/message flows? → A: Require real database persistence for this UI feature before implementing project/message flows.
- Q: Should selected project details use a dedicated `/projects/$projectId` route or a master-detail workspace within `/projects`? → A: Use one master-detail route at `/projects` with selected project stored in UI state or query state.
- Q: What should be the source of truth for visual styling rules? → A: Use `DESIGN.md` tokens as the source of truth, mapped into existing Tailwind/CSS variables.
- Q: Is mobile/responsive support required in the MVP or can it be deferred? → A: Mobile/responsive support is required in MVP; panels may stack or use toggles on small screens.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start a Storefront From a Prompt (Priority: P1)

A merchant arrives at the builder home page, reads a friendly explanation of the product, enters a natural-language description of the storefront they want, and submits it to start a new storefront project.

**Why this priority**: This is the primary entry point and creates the first valuable artifact for the user.

**Independent Test**: Can be fully tested by opening the home page, entering a long storefront prompt, submitting it, and confirming the user is taken to a project experience with the new project available.

**Acceptance Scenarios**:

1. **Given** the user is on the home page, **When** the page loads, **Then** the user sees a friendly greeting, a short product description, a prompt field, and a clear create button.
2. **Given** the user enters a valid prompt, **When** they submit the form, **Then** the system shows progress feedback and creates a new storefront project.
3. **Given** project creation succeeds, **When** the creation process completes, **Then** the user is taken to the projects area or the newly created project detail view.
4. **Given** project creation fails, **When** the creation process completes, **Then** the user sees a clear error message and their prompt remains available for retry.
5. **Given** the user enters a long prompt, **When** the prompt is displayed or submitted, **Then** the layout remains readable and no content overflows the screen.

---

### User Story 2 - Browse and Select Projects (Priority: P1)

A merchant opens the projects area, reviews their storefront projects, and selects one project to continue working with it.

**Why this priority**: Returning users need a reliable way to find and resume work on existing storefronts.

**Independent Test**: Can be fully tested by viewing the projects page with zero, one, and multiple projects, then selecting a project and confirming its selected state and details appear.

**Acceptance Scenarios**:

1. **Given** the user has projects, **When** they open the projects page, **Then** each project shows its name, summary or initial prompt, status, and last update time when available.
2. **Given** the user selects a project, **When** the project is selected, **Then** the selected project has a clear visual state and its workspace content appears.
3. **Given** the user has no projects, **When** they open the projects page, **Then** they see a friendly empty state and a clear action to return home and create a project.

---

### User Story 3 - Review and Continue Project Conversation (Priority: P1)

A merchant selects a project, reviews the conversation history, distinguishes their messages from the assistant's messages, and sends a follow-up message to continue shaping the storefront.

**Why this priority**: Conversation is the core interaction model for iterative storefront creation.

**Independent Test**: Can be fully tested by selecting a project with existing messages, sending a valid follow-up message, and confirming both the user's message and the assistant response appear in order.

**Acceptance Scenarios**:

1. **Given** a project has messages, **When** the project is selected, **Then** messages appear in chronological order.
2. **Given** messages are displayed, **When** the user reviews the conversation, **Then** user messages and assistant messages are visually distinct and labeled clearly.
3. **Given** the user enters a non-empty follow-up message, **When** they send it, **Then** the message is appended to the conversation and the input is cleared after success.
4. **Given** the user attempts to send an empty message, **When** they submit, **Then** no message is sent and the user can continue typing.
5. **Given** message sending or assistant response fails, **When** the failure occurs, **Then** the user sees an error state without losing their typed content or existing message history.

---

### User Story 4 - Explore Generated Storefront Structure (Priority: P2)

A merchant views a project workspace that includes a generated storefront structure, browses nested folders and files, selects an item, and sees basic information or preview content for the selected item.

**Why this priority**: The file/folder explorer helps users understand what the builder has generated without requiring a full code editor.

**Independent Test**: Can be fully tested by selecting a project with a nested virtual structure, choosing folders and files, and confirming item type, nesting, selected state, and preview details are clear.

**Acceptance Scenarios**:

1. **Given** a selected project has generated structure, **When** the workspace loads, **Then** folders and files are displayed with clear visual differences and nested hierarchy.
2. **Given** the user selects a file or folder, **When** the item is selected, **Then** the item has a clear selected state and the workspace shows basic content or metadata when available.
3. **Given** a selected project has no generated structure, **When** the explorer area loads, **Then** a friendly empty state explains that no files or folders are available yet.
4. **Given** the user opens the workspace on a small screen, **When** all panels are present, **Then** the layout remains usable without broken or overflowing panels.

---

### User Story 5 - Prepare Storefronts for Installable Output (Priority: P3)

A merchant's generated storefront includes optional installable-app metadata so that future publish or export flows can produce a storefront with manifest data, icons, display settings, and a safe offline fallback policy when enabled.

**Why this priority**: Installable output increases the usefulness of generated storefronts, but it depends on the core project and workspace flows first.

**Independent Test**: Can be fully tested by inspecting a project with installable output enabled and confirming the required configuration is present, valid, and does not affect the builder dashboard experience.

**Acceptance Scenarios**:

1. **Given** installable output is enabled for a storefront project, **When** the project is prepared for output, **Then** the generated output includes valid app metadata with name, short name, colors, display mode, start URL, scope, icons, and offline setting.
2. **Given** a project lacks custom icons, **When** installable output is prepared, **Then** safe placeholder icons or defaults are used without misleading brand claims.
3. **Given** installable output is disabled, **When** the project is prepared for output, **Then** installable-app files are not required and the builder dashboard remains unaffected.
4. **Given** dynamic or sensitive data is part of the storefront experience, **When** offline behavior is configured, **Then** sensitive dynamic data is not cached for offline reuse.

### Edge Cases

- Empty, whitespace-only, or extremely long prompts and messages are handled without creating invalid content or breaking layout.
- Project creation, project loading, message sending, and assistant response failures show recoverable error states.
- Projects with no messages show a friendly empty conversation state.
- Projects with no files or folders show a friendly explorer empty state.
- Deeply nested folders and long file names remain readable and selectable.
- Message content is displayed as safe text or safe basic formatting only; raw HTML is never rendered.
- Missing project timestamps, descriptions, statuses, or selected files fall back to clear default labels.
- Small screens preserve access to project selection, explorer, messages, and composer without horizontal overflow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a home experience with a friendly greeting, a short explanation of the AI Storefront Builder, a prompt entry field, and a clear create action.
- **FR-002**: System MUST allow users to submit a non-empty storefront prompt from the home experience.
- **FR-003**: System MUST show loading feedback while a storefront project is being created.
- **FR-004**: System MUST show a recoverable error state when storefront project creation fails.
- **FR-005**: System MUST create a new storefront project from a valid submitted prompt and preserve the initial prompt with the project.
- **FR-006**: System MUST add at least one user message containing the initial prompt to each newly created project.
- **FR-007**: System SHOULD add an assistant placeholder or response message after project creation when a real response is not yet available.
- **FR-008**: System MUST move the user to the projects area or the new project detail after successful project creation.
- **FR-009**: System MUST provide a projects experience that lists the user's storefront projects.
- **FR-010**: Each listed project MUST show a name, description or initial prompt summary, status, and last updated time when available.
- **FR-011**: System MUST provide a friendly empty state when no projects exist, including a clear action to start a new project.
- **FR-012**: Users MUST be able to select a project from the projects experience within the same projects workspace.
- **FR-013**: System MUST clearly indicate which project is currently selected in the master-detail projects workspace.
- **FR-014**: System MUST display the selected project's message history in chronological order.
- **FR-015**: System MUST visually distinguish messages sent by the user from messages sent by the assistant.
- **FR-016**: System MUST label or otherwise identify user messages and assistant messages clearly.
- **FR-017**: System MUST provide a message composer for the selected project.
- **FR-018**: System MUST prevent sending empty or whitespace-only messages.
- **FR-019**: System MUST disable or otherwise guard message entry while a message is being sent.
- **FR-020**: System MUST clear the message composer after a message is sent successfully.
- **FR-021**: System MUST append the user's new message to the selected project's conversation after successful submission.
- **FR-022**: System MUST append an assistant response or placeholder response when one is available.
- **FR-023**: System MUST show loading feedback while a message is being sent or an assistant response is pending.
- **FR-024**: System MUST show a recoverable error state when message sending fails.
- **FR-025**: System MUST keep message content within the layout and wrap long text safely.
- **FR-026**: System MUST NOT render raw HTML from user, project, file, or message content.
- **FR-027**: System MUST provide a single projects workspace layout containing project selection, file/folder explorer, message history, and message composer areas.
- **FR-028**: System MUST display the selected project's virtual file/folder structure when available.
- **FR-029**: System MUST support nested folders and files inside folders in the explorer.
- **FR-030**: System MUST visually distinguish folders from files.
- **FR-031**: Users MUST be able to select a file or folder in the explorer.
- **FR-032**: System MUST clearly indicate which file or folder is selected.
- **FR-033**: System SHOULD show preview content or basic metadata for the selected file or folder when available.
- **FR-034**: System MUST provide a friendly empty explorer state when a project has no files or folders.
- **FR-035**: System MUST remain usable on small screens in the MVP without broken panels or horizontal layout overflow; workspace panels may stack or use toggles on small screens.
- **FR-036**: System MUST follow the project's approved visual design rules for colors, spacing, typography, radius, shadows, component styling, and responsive layout, using `DESIGN.md` tokens as the source of truth mapped into the existing style setup.
- **FR-037**: System MUST represent storefront projects with project metadata, initial prompt, status, timestamps, messages, virtual file/folder structure, and installable output configuration.
- **FR-038**: System MUST support installable output configuration per storefront project with enabled state, app names, description, colors, display setting, start URL, scope, icons, and offline fallback setting.
- **FR-039**: System MUST validate installable output configuration before preparing a storefront for output.
- **FR-040**: System MUST include valid app metadata in storefront output when installable output is enabled.
- **FR-041**: System MUST use safe default or placeholder icons when custom icons are unavailable.
- **FR-042**: System MUST allow installable output to be disabled per project.
- **FR-043**: System MUST ensure installable output settings do not change or degrade the builder dashboard experience.
- **FR-044**: System MUST avoid caching sensitive or dynamic storefront data for offline use.
- **FR-045**: System MUST persist project, message, virtual file/folder, and installable output configuration data through the product database for this feature.
- **FR-046**: System MUST keep project data access behind a clear service boundary so UI behavior is not coupled directly to storage details.
- **FR-047**: System MUST NOT store or expose secrets in project data, messages, output metadata, or visible UI.
- **FR-048**: System MUST establish the builder UI on the approved application foundation before implementing the user-facing routes, rather than extending the current temporary scaffold when it conflicts with that foundation.

### Key Entities *(include if feature involves data)*

- **Project**: A storefront workspace created from a user prompt. Key information includes identifier, name, description, initial prompt, status, creation time, update time, messages, virtual file/folder structure, and installable output configuration.
- **Message**: A conversation entry associated with one project. Key information includes identifier, project reference, sender role, content, status, and creation time.
- **ProjectFileNode**: A virtual representation of a generated storefront file or folder. Key information includes identifier, project reference, name, item type, path, parent relationship, child items, content type, content or metadata, creation time, and update time.
- **Installable Output Configuration**: Per-project settings that determine whether installable storefront output is generated. Key information includes enabled state, app name, short name, description, theme color, background color, display setting, start URL, scope, icon list, and offline fallback preference.
- **Installable Output Icon**: Icon metadata for generated storefront output. Key information includes source path, sizes, media type, and purpose.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of users can create a storefront project from the home page in under 2 minutes during usability testing.
- **SC-002**: At least 95% of successful project creations take the user to a project workspace or projects area without manual refresh.
- **SC-003**: Users can identify the selected project, selected file or folder, user messages, and assistant messages correctly in at least 9 out of 10 moderated test attempts.
- **SC-004**: Users can send a valid follow-up message from a selected project in under 30 seconds after opening the workspace.
- **SC-005**: Empty, loading, and error states are present for project creation, project listing, conversation, file explorer, and message sending in 100% of relevant acceptance tests.
- **SC-006**: Long prompts, long messages, long file names, and nested folder structures do not cause horizontal overflow in supported viewport sizes during visual verification.
- **SC-007**: 100% of displayed message and file content is rendered without executing raw HTML.
- **SC-008**: 100% of projects with installable output enabled have valid app metadata before output preparation completes.
- **SC-009**: Installable output settings affect only generated storefront output and have no visible side effects on the builder dashboard in regression checks.
- **SC-010**: 90% of first-time users describe the workspace organization as clear or very clear after completing project selection, file browsing, and messaging tasks.

## Assumptions

- The first release serves a single signed-in or otherwise current user context; multi-user permissions are outside this feature unless already provided by the surrounding product.
- Temporary demo or mock project data is not sufficient for project, message, file/folder, or installable output flows in this feature; those flows require product database persistence.
- Assistant responses may be mocked or placeholder responses until real generation is connected, but they must be clearly presented as assistant messages.
- File/folder explorer items represent the generated storefront's virtual structure, not necessarily real source files.
- The initial virtual structure may include common storefront assets, app metadata, and content sections to help users understand generated output.
- File selection provides preview content or metadata only; full editing, creation, rename, and delete operations are outside this feature.
- Installable output is optional per storefront project and is designed for generated storefronts, not the builder dashboard itself.
- Placeholder icons are acceptable when no project-specific brand icons exist, provided they do not impersonate a brand.
- The visual design reference already defines the approved look and feel; this feature applies it by mapping its tokens into the existing Tailwind and CSS variable setup without changing the reference.
- The current route scaffold is temporary and may be replaced where needed to align the builder UI with the approved application foundation.
- The selected project workspace is presented as master-detail inside the projects experience rather than as a separate project detail page.
- Mobile and responsive behavior is part of MVP acceptance, with stacking or toggled panels acceptable for small screens.
- Checkout, payments, product management, drag-and-drop editing, publishing providers, real AI integration, streaming responses, and full offline storefront behavior are outside this feature.
