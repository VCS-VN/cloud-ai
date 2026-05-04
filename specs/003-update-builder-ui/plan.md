# Implementation Plan: Builder Pages UI Refresh

**Branch**: `003-update-builder-ui` | **Date**: 2026-05-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/003-update-builder-ui/spec.md`

## Summary

Refresh the Home, Projects, and Project Detail experiences into a compact AI website-builder web app UI. The plan keeps existing project data and server functions intact, uses DESIGN.md as the visual source of truth, follows the provided Lovable-style screenshots as layout inspiration only, and prioritizes route/component/CSS updates: friendly non-technical home copy, projects management with left sidebar plus searchable project list, and project detail with a main Preview/Code surface and right-side chat panel.

## Technical Context

**Language/Version**: TypeScript with React on current stable Node.js LTS  
**Primary Dependencies**: TanStack Router, TanStack Start server functions, React, Tailwind CSS v4 token mapping, existing project/message server functions  
**Storage**: Existing project/message storage only; no new persisted data required for this UI refresh  
**Testing**: TypeScript `tsc --noEmit` via `pnpm lint`; production build via `pnpm build`; visual QA in supported tablet/desktop browser widths  
**Target Platform**: Web builder dashboard for iPad/tablet and desktop viewports  
**Project Type**: Single full-stack web application with file-based routes in `src/routes`  
**Performance Goals**: Target pages render without visible layout jank; project search/filter feels immediate for current project-list sizes; long names/prompts/messages do not cause horizontal overflow  
**Constraints**: Use `DESIGN.md` tokens; do not copy external brand assets from screenshots; phone-sized mobile layouts are out of scope; prioritize `src/routes`, `src/components`, and `app/styles/globals.css`; avoid unrelated data, AI generation, auth, or publishing changes  
**Scale/Scope**: Three target page experiences: Home, Projects management, and selected Project Detail; responsive from iPad/tablet width upward

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution file still contains placeholder principles and no enforceable project-specific gates. This plan applies the existing repository guidance instead:

- **Spec-first workflow**: PASS — feature spec exists at `specs/003-update-builder-ui/spec.md` and this plan is generated under the same feature directory.
- **Implementation focus**: PASS — plan is scoped to UI components, routes, and CSS as requested.
- **Design source of truth**: PASS — `DESIGN.md` remains the styling reference; screenshots guide layout only.
- **Minimal business logic change**: PASS — no new storage, project lifecycle, auth, or generation behavior is introduced.
- **Responsive requirement**: PASS — plan explicitly supports iPad/tablet and larger viewports while excluding phone-specific mobile work.

## Project Structure

### Documentation (this feature)

```text
specs/003-update-builder-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── routes/
│   ├── index.tsx              # Home page refresh
│   └── projects.tsx           # Projects management and selected detail composition
├── components/
│   ├── home/
│   │   └── HomePromptForm.tsx # Compact prompt entry surface
│   ├── projects/
│   │   ├── ProjectList.tsx
│   │   ├── ProjectListItem.tsx
│   │   ├── ProjectFileExplorer.tsx
│   │   ├── FilePreviewPanel.tsx
│   │   ├── ProjectMessagesPanel.tsx
│   │   ├── MessageBubble.tsx
│   │   └── MessageComposer.tsx
│   └── common/
│       ├── EmptyState.tsx
│       ├── ErrorState.tsx
│       └── LoadingState.tsx
└── styles.css                 # DESIGN.md token usage and compact builder UI utilities
```

**Structure Decision**: Use the existing `src/routes` and `src/components` application structure. The UI refresh should be implemented primarily by reshaping `src/routes/index.tsx`, `src/routes/projects.tsx`, reusable home/project components, shared state components, and `app/styles/globals.css`. No new backend module or data model directory is required.

## Phase 0: Research Summary

Research is captured in [research.md](./research.md). Key decisions:

- Use a compact Lovable-inspired builder shell without copying brand-specific visuals.
- Rewrite home welcome text to be human, outcome-oriented, and not overly technical.
- Structure Projects as left sidebar navigation plus searchable project list.
- Structure Project Detail as main Preview/Code output plus right-side chat.
- Reduce component scale locally for builder UI rather than globally shrinking DESIGN.md tokens.
- Support responsive behavior from iPad/tablet widths upward; phone mobile remains out of scope.

## Phase 1: Design Summary

Design artifacts are captured in:

- [data-model.md](./data-model.md): UI-used entities and UI-only state for filters, search, view mode, and chat.
- [contracts/ui-contract.md](./contracts/ui-contract.md): User-facing contracts for Home, Projects, Project Detail, responsive behavior, and visual consistency.
- [quickstart.md](./quickstart.md): Implementation order and validation checklist.

### Route-Level Design

- **Home `/`**: Minimal builder landing surface with friendly Vietnamese headline/copy, compact prompt composer, and practical examples. Avoid implementation-focused terms in the first screen.
- **Projects `/projects` without selected project emphasis**: Management shell with a left sidebar menu and right project list/search area. Empty and no-result states guide users back to project creation or clearing search.
- **Project Detail selected state**: Preserve selected project context while presenting main output on the left/center and chat on the right. Add Preview/Code switch at the top of the output area.

### Component-Level Design

- **Prompt input**: Compact, focused, with smaller padding and clearer send/create action.
- **Sidebar menu**: Vertical, scannable, with selected state independent from selected project.
- **Project list items**: Smaller card/list row treatment with concise status and recency.
- **Preview/Code switch**: Compact segmented control in the project detail top bar.
- **Chat frame**: Right-side panel with message history and composer; tablet layouts may stack but must keep the chat discoverable.
- **State components**: Empty/loading/error surfaces should be compact and friendly, not oversized editorial sections.

## Post-Design Constitution Check

- **Spec-first workflow**: PASS — plan and artifacts are stored under `specs/003-update-builder-ui`.
- **Implementation focus**: PASS — all planned source changes are route/component/CSS-level.
- **Design source of truth**: PASS — design contract keeps `DESIGN.md` tokens as source of truth and treats screenshots as layout references only.
- **Minimal business logic change**: PASS — design does not require new persistence or backend contracts.
- **Responsive requirement**: PASS — quickstart includes iPad/tablet, laptop, and desktop visual QA.

## Complexity Tracking

No constitution violations or required complexity exceptions.
