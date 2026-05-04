# Feature Specification: Builder Pages UI Refresh

**Feature Branch**: `003-update-builder-ui`  
**Created**: 2026-05-04  
**Status**: Draft  
**Input**: User description: "Cập nhật UI của các trang home, projects và project detail theo hướng cấu trúc của một website builder bằng prompt AI. User có thể quản lý projects và project detail. UI thân thiện, gọn gàng, responsive từ iPad trở lên, ưu tiên component UI và CSS, quan sát thiết kế hiện có và sử dụng DESIGN.md làm nguồn token."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand the AI Builder Entry Point (Priority: P1)

A user opens the home page and immediately understands that the product helps them build a website from an AI prompt, with a clear prompt-focused entry point and supporting context that feels like a polished web product rather than a broken design mockup.

**Why this priority**: The home page is the first impression and must communicate the product promise before users can create or manage projects.

**Independent Test**: Can be tested by opening the home page at supported tablet and desktop widths, reviewing the hierarchy, entering a website-building prompt, and confirming the page remains readable, balanced, and action-oriented.

**Acceptance Scenarios**:

1. **Given** a user opens the home page on an iPad-sized viewport, **When** the page loads, **Then** the hero, prompt input, primary action, and supporting examples are visible without horizontal overflow.
2. **Given** a user is unfamiliar with the product, **When** they scan the first screen, **Then** they can identify that the site builds websites from AI prompts and where to start.
3. **Given** a user enters a long prompt, **When** the prompt field expands or wraps content, **Then** surrounding content remains aligned and no key action is pushed into an unusable position.
4. **Given** DESIGN.md typography and visual tokens are applied, **When** headings, body text, cards, and actions appear together, **Then** the page uses a coherent hierarchy suitable for a website builder product.

---

### User Story 2 - Manage Projects From a Clean Projects Page (Priority: P1)

A returning user opens the projects page, sees a tidy overview of their website projects, understands project status at a glance, and can select or continue a project without visual clutter.

**Why this priority**: Project management is core to users returning to continue work, compare projects, and avoid losing context.

**Independent Test**: Can be tested by viewing the projects page with empty, single-project, and multi-project states across supported widths and confirming project cards/list items are clear and actionable.

**Acceptance Scenarios**:

1. **Given** the user has no projects, **When** they open the projects page, **Then** they see a friendly empty state with a clear path to create a first website project.
2. **Given** the user has multiple projects, **When** they open the projects page, **Then** each project presents name, prompt or description, status, recency, and a clear continue/select action.
3. **Given** the project list contains long names or prompts, **When** the page renders, **Then** content wraps or truncates in a controlled way without breaking card/list layout.
4. **Given** the user navigates at tablet width, **When** project management content becomes constrained, **Then** the layout keeps navigation, filters or grouping, and project actions discoverable without requiring mobile-specific patterns.

---

### User Story 3 - Work With Project Detail Clearly (Priority: P1)

A user selects a project and sees a project detail experience that clearly separates project summary, conversation or prompt activity, generated website structure, preview information, and project actions.

**Why this priority**: Project detail is where users evaluate and continue building their AI-generated website, so broken composition directly blocks the product goal.

**Independent Test**: Can be tested by opening a selected project detail state and confirming users can identify current project context, send or review prompt activity, inspect generated structure, and return to project management.

**Acceptance Scenarios**:

1. **Given** a project is selected, **When** the detail page or detail area opens, **Then** the user sees project identity, status, last update, and primary next action in a stable header or summary area.
2. **Given** project detail includes multiple functional regions, **When** the user scans the page, **Then** conversation/activity, generated structure, and preview/detail information are visually distinct and logically ordered.
3. **Given** generated structure or messages are empty, loading, or unavailable, **When** the detail UI renders, **Then** each region presents a compact state that explains what is happening and what the user can do next.
4. **Given** the user uses an iPad or desktop viewport, **When** project detail content changes length, **Then** panels resize, wrap, or stack cleanly without hiding important controls.

---

### User Story 4 - Experience Consistent Responsive Visual Design (Priority: P2)

A user moves between home, projects, and project detail pages and experiences a consistent, friendly interface aligned with the existing visual system and appropriate for tablet and desktop usage.

**Why this priority**: Consistency reduces cognitive load and ensures the UI refresh fixes the broader page composition problem, not just isolated elements.

**Independent Test**: Can be tested by comparing the three pages at supported widths and checking spacing, typography, action styling, card treatment, and responsive behavior against DESIGN.md-driven expectations.

**Acceptance Scenarios**:

1. **Given** the user navigates across the three pages, **When** repeated UI elements appear, **Then** headings, buttons, inputs, cards, empty states, and panels feel visually related.
2. **Given** supported viewport widths from iPad upward, **When** the layout adapts, **Then** content remains readable and actions remain reachable without mobile-only navigation assumptions.
3. **Given** design screenshot guidance is used as visual direction, **When** page composition is reviewed, **Then** the pages favor a builder-style web app structure over Figma-canvas fragments or overly decorative storefront sections.

### Edge Cases

- Empty project lists must not leave large confusing blank areas or broken containers.
- Long project names, long prompts, long message content, and nested file names must not create horizontal scrolling in supported viewports.
- Missing project detail content must show compact placeholders rather than collapsing the page structure.
- Dense project lists must remain scannable with clear selection, continuation, and status cues.
- Tablet-width layouts must avoid cramped multi-column panels that make the interface feel unusable.
- Existing visual tokens must not be applied at sizes that make builder controls look like oversized marketing content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The home page MUST communicate the AI website-builder purpose within the first visible screen at supported tablet and desktop widths.
- **FR-002**: The home page MUST provide a prominent prompt-entry area with a clear primary action for starting or continuing website creation.
- **FR-003**: The home page MUST include supporting guidance, examples, or contextual copy that helps users understand what kind of website prompt to write.
- **FR-004**: The projects page MUST present a manageable overview of projects with clear project identity, status, recency, and continuation affordance.
- **FR-005**: The projects page MUST provide a useful empty state that guides users toward creating their first project.
- **FR-006**: The project detail experience MUST show the selected project's identity, status, recent activity, and primary next action in a stable, easy-to-find area.
- **FR-007**: The project detail experience MUST separate project activity or conversation, generated website structure, and preview/detail information into visually distinct regions.
- **FR-008**: Users MUST be able to understand which project is currently selected or being edited from the project detail UI.
- **FR-009**: Users MUST be able to move from the projects overview to a project detail state and back to project management without losing orientation.
- **FR-010**: The refreshed pages MUST use DESIGN.md as the visual source of truth for typography, color, spacing, radius, and component treatment.
- **FR-011**: The refreshed pages MUST adapt cleanly from iPad-sized viewports upward; mobile phone viewports are explicitly outside this feature's supported scope.
- **FR-012**: The refreshed pages MUST avoid horizontal overflow for long prompts, project names, messages, generated item names, and action labels at supported widths.
- **FR-013**: The refreshed UI MUST include readable empty, loading, and unavailable states for project list and project detail regions.
- **FR-014**: Reusable UI patterns for cards, panels, prompt inputs, project list items, states, and action areas MUST appear consistent across the three target pages.
- **FR-015**: The UI refresh MUST prioritize page-level composition, reusable UI components, and styling rules over changing unrelated business behavior.
- **FR-016**: The refreshed pages MUST preserve existing project management meaning, including project overview and selected project detail, while improving usability and visual clarity.

### Key Entities *(include if feature involves data)*

- **Project**: A user-managed website-building workspace. It is represented by name, prompt or description, status, recency, and continuation or detail access.
- **Project Detail**: The selected project's working view. It includes project identity, summary, activity or messages, generated structure, preview/detail information, and available next actions.
- **Prompt**: A natural-language instruction used to start or continue building a website. It may be short or long and must remain readable in the UI.
- **Generated Structure Item**: A visible representation of generated website pages, sections, files, or folders within project detail.
- **UI State**: A visual state such as empty, loading, selected, unavailable, or error that helps users understand the current condition of project management areas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of usability-test participants can explain the home page's AI website-builder purpose within 10 seconds of viewing it.
- **SC-002**: At least 90% of users can locate the prompt entry and primary start action on the home page without assistance.
- **SC-003**: At least 90% of users can identify how many projects they have and which project to continue within 20 seconds on the projects page.
- **SC-004**: At least 90% of users can identify the selected project and its primary next action within 10 seconds on the project detail experience.
- **SC-005**: Visual verification confirms no horizontal overflow on home, projects, or project detail pages at supported viewport widths from iPad landscape and larger.
- **SC-006**: Visual verification confirms empty, loading, and unavailable states remain structured and readable in 100% of target page regions.
- **SC-007**: Design review confirms repeated buttons, inputs, cards, panels, and typography treatments are consistent across all three target pages.
- **SC-008**: At least 80% of reviewed screen compositions are rated as friendly, tidy, and appropriate for an AI website-builder web app by product stakeholders.

## Assumptions

- The design screenshots referenced by the request are available to the implementation team or already reflected in current project design materials; this specification uses them as directional visual references rather than embedding them.
- DESIGN.md remains the source of truth for the approved visual language, but typography scale may be applied responsively so builder controls remain usable.
- The supported responsive range starts at iPad-sized/tablet viewports; phone-sized mobile layouts are out of scope for this feature.
- Existing project data, messages, generated structure, and preview concepts remain in scope only as UI presentation concerns unless separately specified.
- The project may currently support project detail as either a dedicated page or selected detail area; this feature requires the user-facing detail experience to be clear regardless of routing structure.
- The refresh should focus on component UI and CSS while avoiding unrelated data model, generation, authentication, or publishing changes.
