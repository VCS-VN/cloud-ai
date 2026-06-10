# Feature Specification: Init Settings Seed

**Feature Branch**: `[030-init-settings-seed]`  
**Created**: 2026-06-10  
**Status**: Draft  
**Input**: User description: "Runtime pre-seed setting files for Codex SDK init before the Agent runs. Seed project settings from one Markdown template per target file, install dependencies after seed, keep protected files runtime-owned, and let the Agent customize editable storefront styling and root layout."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initialize a preview-ready storefront (Priority: P1)

As a user starting a new storefront from a prompt, I need the project infrastructure to exist before the Agent creates routes and components, so the generated storefront can build and start preview after init.

**Why this priority**: This fixes the primary failure mode: Agent-created code exists, but required project settings are missing, so preview cannot start.

**Independent Test**: Start a new project init from an empty workspace and verify that required settings, root route baseline, global styles, dependency installation, generated routes/components, build validation, and preview health all complete without the Agent creating runtime-owned settings.

**Acceptance Scenarios**:

1. **Given** an empty project workspace, **When** init begins, **Then** the system creates the runtime-owned settings and editable baseline files before the Agent receives its first build instruction.
2. **Given** settings were seeded successfully, **When** dependency setup runs, **Then** the workspace has installed dependencies and a lockfile baseline before snapshots and Agent diff tracking begin.
3. **Given** the Agent creates storefront routes and components, **When** validation runs, **Then** the project can complete build and preview-health checks using the seeded infrastructure.

---

### User Story 2 - Protect runtime-owned settings during init (Priority: P2)

As a maintainer, I need runtime-owned settings to remain deterministic and protected from Agent edits, so init runs do not fail due to unsafe or inconsistent project configuration changes.

**Why this priority**: The system already treats these paths as protected. The new seed flow must preserve that boundary instead of asking the Agent to create or modify protected files.

**Independent Test**: Run init in a workspace with missing settings, matching settings, and conflicting settings; verify missing settings are created, matching settings are accepted, and conflicting runtime-owned settings fail fast with a clear blocked-request outcome.

**Acceptance Scenarios**:

1. **Given** a runtime-owned setting file is missing, **When** seeding runs, **Then** the system writes the template content to the target path.
2. **Given** a runtime-owned setting file exists with the same content as the template, **When** seeding runs, **Then** the system accepts it without changes.
3. **Given** a runtime-owned setting file exists with different content, **When** seeding runs, **Then** init stops before Agent execution with a clear conflict failure.
4. **Given** the Agent runs after seeding, **When** it attempts to modify runtime-owned settings or lockfiles, **Then** existing protected-path enforcement rejects those Agent changes.

---

### User Story 3 - Allow safe storefront theme customization (Priority: P3)

As a user choosing a storefront style, I need the Agent to customize theme and layout safely without modifying runtime-owned configuration, so the storefront can reflect the selected design while staying buildable.

**Why this priority**: The Agent still needs freedom to apply visual variants and root layout wiring, but those edits should happen in allowed storefront files rather than protected settings.

**Independent Test**: Run init with a selected design style and verify the Agent can update global styling tokens and root layout while runtime-owned settings remain unchanged.

**Acceptance Scenarios**:

1. **Given** the global stylesheet is missing, **When** seeding runs, **Then** the system creates it with standard Tailwind directives and baseline theme tokens.
2. **Given** the global stylesheet already exists, **When** seeding runs, **Then** the system leaves it unchanged so prior Agent styling is preserved.
3. **Given** the root route baseline is missing, **When** seeding runs, **Then** the system creates a minimal root shell that imports global styles.
4. **Given** the Agent needs to wire providers, header, footer, or style tokens, **When** it builds the storefront, **Then** it may edit the global stylesheet and root route without touching runtime-owned settings.

---

### Edge Cases

- Runtime-owned setting exists but differs from template content: init must stop before Agent execution and report a conflict rather than overwrite.
- Editable baseline file exists with user or Agent changes: seed must leave it unchanged.
- Template metadata target does not match the expected target path: init must stop as an invalid seed template.
- Template target is absolute or contains parent-directory traversal: init must stop as an invalid seed template.
- Dependency artifacts are partially present: dependency setup must run unless both dependency directory and lockfile baseline already exist.
- Dependency setup fails: init must stop before Agent execution and report setup failure without blaming Agent-generated storefront code.
- Agent attempts to modify protected settings or lockfiles after baseline snapshot: existing protected-path enforcement must reject the run.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST pre-seed project infrastructure before the Agent receives any init build instruction.
- **FR-002**: System MUST source seed content from one Markdown template per target file, where each template declares its intended target and contains the exact file content to write.
- **FR-003**: System MUST validate each template target before writing, including target match, relative-path safety, and rejection of parent-directory traversal.
- **FR-004**: System MUST seed these runtime-owned settings when missing and accept them when already identical: package metadata, build configuration, type-check configuration, styling configuration, post-processing configuration, and router setup.
- **FR-005**: System MUST refuse to overwrite a runtime-owned setting that already exists with different content and must stop init before Agent execution.
- **FR-006**: System MUST seed editable baseline files for global styling and root route shell when missing, and MUST leave those files unchanged when they already exist.
- **FR-007**: System MUST NOT seed obsolete or framework-inappropriate application entry files for this flow.
- **FR-008**: System MUST keep runtime-owned settings and lockfiles protected from Agent edits after baseline snapshot.
- **FR-009**: System MUST allow the Agent to edit global storefront styling and root layout files during init.
- **FR-010**: System MUST provide an SEO-capable storefront baseline suitable for public publishing.
- **FR-011**: System MUST exclude unrelated backend, testing, deployment, AI-provider, database, and PWA capabilities from the seeded storefront baseline.
- **FR-012**: System MUST install workspace dependencies after settings are seeded and before file manifest collection, context building, baseline snapshot, or Agent execution.
- **FR-013**: System MUST skip dependency installation only when both dependency directory and lockfile baseline already exist.
- **FR-014**: System MUST treat lockfile output from dependency installation as baseline runtime setup, not as an Agent-created change.
- **FR-015**: System MUST keep init planning batches focused on Agent-owned storefront files and MUST NOT add settings files to Agent batch scope.
- **FR-016**: System MUST update Agent-facing init instructions so the Agent knows which files are runtime-owned, which files are editable, and where theme customization belongs.
- **FR-017**: System MUST preserve existing protected-path rules for this feature.
- **FR-018**: System MUST surface setup conflicts and dependency setup failures with clear failure reasons before Agent generation begins.

### Key Entities

- **Seed Template**: A Markdown file that declares one target path and contains exact content for a generated project file.
- **Runtime-Owned Setting**: A protected project file that runtime may seed and the Agent must not modify.
- **Editable Baseline File**: A project file created by runtime when missing but intentionally left editable by the Agent.
- **Dependency Baseline**: Installed dependency artifacts and lockfile state created before Agent diff tracking begins.
- **Init Workspace**: The generated project directory prepared by runtime before the Agent creates storefront files.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of new init runs from an empty workspace create all required runtime-owned settings before Agent execution begins.
- **SC-002**: 100% of init runs with conflicting runtime-owned settings stop before Agent execution and identify the conflicting path.
- **SC-003**: 100% of init runs that complete seeding and dependency setup establish the lockfile and dependency baseline before Agent diff tracking begins.
- **SC-004**: 0 runtime-owned settings are reported as Agent-created or Agent-modified in successful init runs.
- **SC-005**: Users can preview an initialized storefront without manually adding missing project settings.
- **SC-006**: The Agent can customize visual theme and root layout through editable storefront files while protected settings remain unchanged.
- **SC-007**: The generated storefront baseline supports externally published pages with crawler-readable page structure and metadata capability.
- **SC-008**: Manual validation of a successful init run confirms build and preview-health checks complete after Agent generation.

## Assumptions

- Init workspaces are prepared by runtime before Agent execution and can be safely modified by runtime-owned setup steps.
- Dependency installation is allowed during init setup and uses the project-standard package manager.
- The generated storefront is intended for eventual public publishing, so SEO-capable rendering is part of the baseline.
- Existing protected-path enforcement remains responsible for rejecting Agent edits to runtime-owned settings and lockfiles.
- No new automated tests are required for this feature; validation relies on manual checks and existing validation gates.
- Existing update/redesign flows should not gain new permission to modify runtime-owned settings.
