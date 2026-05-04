# Research: Builder Pages UI Refresh

## Decision: Use a compact Lovable-inspired builder shell without copying brand-specific styling

**Rationale**: The provided screenshots show a friendly web-builder structure: a minimal hero centered on a large prompt box, a persistent left navigation shell for workspace/project management, and compact control surfaces. The implementation should adopt the interaction pattern and spatial organization while keeping DESIGN.md as the visual source of truth for tokens, typography, radius, and color.

**Alternatives considered**:
- Keep the current editorial card-heavy layout: rejected because the current large headings/cards make builder controls feel oversized and less like a working web app.
- Recreate screenshot gradients and branding directly: rejected because the product already has DESIGN.md tokens and must not depend on another brand's visual identity.

## Decision: Home page copy should be human, outcome-oriented, and less technical

**Rationale**: The user explicitly asked for welcome text that is friendly and not overly technical. The home page should describe what users can create and give prompt examples in plain Vietnamese, avoiding terms like workspace, agent, schema, file tree, or generated artifacts in the first impression.

**Alternatives considered**:
- Keep current technical copy: rejected because it over-explains implementation concepts before the user has started.
- Use marketing-heavy copy only: rejected because the page still needs a clear builder prompt entry and practical examples.

## Decision: Projects page uses a two-zone management layout

**Rationale**: The requested projects page places a vertical sidebar menu on the left and the user project list on the right, with search. This supports management tasks better than the current three-column workspace because users can filter, scan recents/categories, and choose a project before entering details.

**Alternatives considered**:
- Keep project list as only one narrow column: rejected because it constrains project summaries and search results.
- Use card grid only: rejected because the user specifically requested sidebar navigation and searchable project listing.

## Decision: Project detail uses main code/preview area plus right-side chat

**Rationale**: The request specifies chat on the right and a top switch for code vs preview. This matches builder expectations: the project output remains primary, while chat becomes the assistant control panel. The top switch should be compact, visible, and stateful within the detail page.

**Alternatives considered**:
- Keep chat as the main central column: rejected because it under-emphasizes preview/code inspection.
- Put chat on the left: rejected because the user explicitly asked for the chat frame on the right.

## Decision: Reduce component scale through local builder UI sizing rules

**Rationale**: DESIGN.md typography includes large editorial sizes that can break dense builder interfaces. The plan should apply DESIGN.md tokens responsively and introduce compact page-level composition for controls, cards, sidebars, and panels so the app feels tidy from iPad upward.

**Alternatives considered**:
- Globally shrink all DESIGN.md tokens: rejected because other areas may rely on those tokens.
- Keep current sizes and only change layout: rejected because the user specifically requested smaller component sizing.

## Decision: Responsive support begins at iPad/tablet widths

**Rationale**: The feature explicitly excludes mobile phone support. Tablet layouts should stack or reduce columns when needed, while desktop can use sidebar + content and detail + chat compositions.

**Alternatives considered**:
- Full mobile navigation and drawers: rejected as out of scope.
- Desktop-only fixed widths: rejected because iPad and larger must remain supported.
