# UI Contract: Builder Pages UI Refresh

## Supported Pages

- Home: `/`
- Projects management: `/projects`
- Project detail: selected project detail state reachable from projects management or an equivalent project-detail route if present

## Home Page Contract

**Must show**:
- Friendly Vietnamese welcome text that explains creating a website with AI prompts.
- Compact prompt input with primary action.
- Plain-language prompt examples or guidance.
- Minimal DESIGN.md-aligned visual treatment.

**Must not show as primary copy**:
- Technical terms such as schema, file tree, agent pipeline, implementation, or database.

## Projects Page Contract

**Must show**:
- Left vertical sidebar menu for project navigation.
- Right-side project list area.
- Search input for narrowing projects.
- Empty and no-result states.
- Compact project items with name, summary, status, and recency.

**Interaction rules**:
- Selecting a project opens or highlights that project's detail state.
- Search must not remove orientation; users can clear or change search easily.
- Sidebar selection and project selection must be visually distinct.

## Project Detail Contract

**Must show**:
- Project identity and concise status context.
- Main output area with a top switch between `Preview` and `Code`.
- Right-side chat frame for messages and prompt follow-up.
- Generated structure or selected code/detail content where available.
- Compact empty/loading/error states for chat and output regions.

**Interaction rules**:
- Switching Preview/Code keeps selected project and chat draft intact.
- Chat remains visible beside the main output on desktop.
- Tablet layouts may stack panels, but chat and mode switch must remain discoverable.

## Responsive Contract

- Supported from iPad/tablet width upward.
- No mobile phone-specific navigation is required.
- No horizontal overflow is acceptable in supported widths.
- Components should use compact spacing and typography compared with the current oversized UI.

## Visual Contract

- DESIGN.md remains the token source for color, typography, spacing, radius, and surface styling.
- Screenshot references inform layout patterns only; do not copy external brand assets or exact gradient identity.
- Reusable page shells, cards, buttons, inputs, tabs/switches, sidebars, and panels must feel consistent across pages.
