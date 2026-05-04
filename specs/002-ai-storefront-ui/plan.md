# Implementation Plan: AI Storefront UI

**Branch**: `002-ai-storefront-ui` | **Date**: 2026-05-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/002-ai-storefront-ui/spec.md`

## Summary

Build the initial AI Storefront Builder UI on a proper TanStack Start foundation. The MVP provides a Home prompt flow, a `/projects` master-detail workspace, project messages, a separate virtual file/folder explorer, and storefront PWA schema/export planning. The implementation must migrate away from the current temporary Vite-style route scaffold where needed, use TanStack Start file-based routing in `src/routes`, avoid manual edits to generated route-tree files, persist project/message/file/PWA data through the product database, and apply `DESIGN.md` tokens through the existing Tailwind/CSS-variable style setup.

## Current Repository Structure

The repo has a partial application and domain layer, but it is not yet structured as TanStack Start file-based routing:

```text
.
├── AGENTS.md
├── DESIGN.md
├── README.md
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── components.json
├── drizzle.config.ts
├── app/
│   ├── routes/
│   │   ├── index.tsx
│   │   ├── projects.tsx
│   │   ├── projects..tsx
│   │   ├── projects.admin.tsx
│   │   └── preview.tsx
│   ├── components/
│   │   ├── editor/
│   │   └── storefront/
│   ├── server/actions/
│   └── styles/globals.css
├── src/
│   ├── ai/
│   ├── db/
│   ├── editing/
│   ├── export/
│   ├── projects/
│   ├── rendering/
│   ├── security/
│   └── storefront/
└── specs/
    ├── 001-ai-storefront-builder/
    └── 002-ai-storefront-ui/
```

Observed implementation context:

- `package.json` currently uses Vite/React/Vitest dependencies and scripts: `lint`, `typecheck`, `test`, `build`; there is no `dev` script yet.
- Routes currently live in `app/routes`, not the required TanStack Start `src/routes` convention for this feature.
- Existing routes are placeholder-style: `app/routes/index.tsx`, `app/routes/projects.tsx`, `app/routes/projects..tsx`, `app/routes/projects.admin.tsx`, `app/routes/preview.tsx`.
- `src/db/schema.ts` has Drizzle tables for `storefront_projects`, `project_revisions`, `generation_records`, and `preview_tokens`.
- `src/projects/repositories.ts` has repository interfaces and an in-memory repository; the clarified feature requires database persistence for UI project/message/file/PWA flows, so repository interfaces should be extended and backed by database implementations.
- `src/storefront/types.ts` and `src/storefront/schema.ts` already define storefront project, pages, products, theme, generation history, and export/publish state.
- `src/export/output-provider.ts` and `src/export/preview-url-provider.ts` exist for output providers; PWA output should extend this pipeline without coupling to the builder dashboard.
- `DESIGN.md` defines the source-of-truth tokens for colors, typography, spacing, rounded values, and component styles. Existing Tailwind/CSS variables only include a small subset and must be expanded/mapped.

## Technical Context

**Language/Version**: TypeScript on current stable Node.js LTS supported by TanStack Start
**Primary Dependencies**: TanStack Start, TanStack Router, React, Drizzle ORM, PostgreSQL driver, Zod, Tailwind CSS, Vitest/jsdom
**Storage**: PostgreSQL via Drizzle ORM tables/repositories; no client-only mock storage for project/message/file/PWA flows
**Testing**: Vitest for unit/integration tests; TypeScript `tsc --noEmit` for typecheck/lint behavior currently configured
**Target Platform**: Server-rendered web app for builder dashboard plus generated storefront output/preview
**Project Type**: Single TanStack Start full-stack web application
**Performance Goals**: Home and Projects should render without visible layout jank; project selection and message composer should feel immediate for MVP-sized project lists; long content must wrap without horizontal overflow
**Constraints**: Use TanStack Start file-based routing in `src/routes`; do not manually edit `routeTree.gen`; use TanStack Start server functions for server-side mutations/load boundaries; keep `/projects` as master-detail workspace; apply `DESIGN.md` tokens via Tailwind/CSS variables; no unsafe raw HTML rendering; no secrets in UI/data; PWA applies to generated storefront output, not builder dashboard
**Scale/Scope**: MVP supports current-user project list, selected project workspace, persisted messages, virtual file tree, selected node metadata/preview, PWA config/schema, and initial PWA output planning; no code editor, file operations, real streaming, auth changes, checkout/payment, publish provider integration, or drag/drop editor

## Constitution Check

The constitution still contains placeholder principles, so this plan applies the effective gates from the feature spec, clarified decisions, and project safety rules:

- **Routing Gate**: PASS — implementation must move builder routes to TanStack Start `src/routes` file-based routing and never hand-edit route-tree generation output.
- **Server Boundary Gate**: PASS — server-side create/list/select/send/load flows must use TanStack Start server functions or route loaders/actions appropriate to the current TanStack Start pattern.
- **Persistence Gate**: PASS — project/message/file/PWA flows must persist through Drizzle/PostgreSQL-backed repositories, not client-only mock state.
- **Design Gate**: PASS — `DESIGN.md` is the token source of truth; existing Tailwind/CSS variables are implementation vehicles, not competing style systems.
- **Security Gate**: PASS — message/file content is plain text or safely formatted only; no raw HTML rendering and no secrets in UI/data.
- **PWA Boundary Gate**: PASS — PWA config and generated files belong to storefront schema/export output, not the builder dashboard shell.
- **Responsive Gate**: PASS — small-screen behavior is part of MVP acceptance, using stacking or toggled panels where needed.

## TanStack Start Guidance Applied

Official TanStack Start guidance used for planning:

- Use file-based routing with route files under `src/routes`.
- The route tree is generated by tooling and should not be edited manually.
- Server-only logic should live behind TanStack Start server functions such as `createServerFn` or route loader/action patterns supported by the scaffold.
- Navigation should use TanStack Router APIs instead of direct `window.location` changes unless unavoidable.

Implementation implication: current `app/routes` files are treated as temporary source examples/placeholders. New builder route files should be created in `src/routes` once TanStack Start is added/configured.

## Proposed Source Structure

```text
src/
├── routes/
│   ├── __root.tsx
│   ├── index.tsx
│   └── projects.tsx
├── components/
│   ├── common/
│   │   ├── EmptyState.tsx
│   │   ├── ErrorState.tsx
│   │   └── LoadingState.tsx
│   ├── home/
│   │   └── HomePromptForm.tsx
│   └── projects/
│       ├── MessageBubble.tsx
│       ├── MessageComposer.tsx
│       ├── ProjectFileExplorer.tsx
│       ├── ProjectFileTreeNode.tsx
│       ├── ProjectList.tsx
│       ├── ProjectListItem.tsx
│       ├── ProjectMessagesPanel.tsx
│       └── FilePreviewPanel.tsx
├── server/
│   └── functions/
│       ├── project-files.ts
│       ├── project-messages.ts
│       └── projects.ts
├── projects/
│   ├── project-service.ts
│   ├── message-service.ts
│   ├── file-tree-service.ts
│   └── repositories.ts
├── db/
│   └── schema.ts
├── storefront/
│   ├── types.ts
│   ├── schema.ts
│   └── defaults.ts
└── export/
    ├── pwa-exporter.ts
    ├── output-provider.ts
    └── preview-url-provider.ts
```

Existing `app/components/*` can be moved or replaced during implementation. Do not duplicate long-lived UI between `app/` and `src/`.

## Route Plan

### Files to Create or Update

- `src/routes/__root.tsx`
  - Owns global document shell, app-level styles import, and common layout providers required by TanStack Start.
  - Imports global CSS mapped from `DESIGN.md` tokens.

- `src/routes/index.tsx`
  - Route: `/`
  - Renders Home page composition: greeting, product description, `HomePromptForm`, loading/error states.
  - Uses TanStack Router navigation to move to `/projects` after successful creation.
  - Uses a TanStack Start server function boundary for project creation.

- `src/routes/projects.tsx`
  - Route: `/projects`
  - Renders master-detail workspace with project list/sidebar, file/folder explorer, main messages panel, and composer.
  - Uses loader/server function boundary for project list and selected project data.
  - Keeps selected project in UI state or query state within the same route, per clarification.
  - Does not require `/projects/$projectId` for MVP.

- Optional future route, not MVP: `src/routes/projects.$projectId.tsx`
  - Only add later if deep-linking becomes a product requirement.

- Existing temporary files to migrate/retire during implementation:
  - `app/routes/index.tsx`
  - `app/routes/projects.tsx`
  - `app/routes/projects..tsx`
  - `app/routes/projects.admin.tsx`
  - `app/routes/preview.tsx`

### Routing Rules

- Do not edit any generated route tree manually.
- Use file names and route exports that match the TanStack Start/TanStack Router file-based routing convention selected by the scaffold.
- Use TanStack Router navigation APIs for successful Home submission and internal workspace changes.
- Use query state for selected project only if it improves refresh/share behavior without becoming a dedicated detail route.

## Component Plan

### Home Components

- `HomePromptForm`
  - Props: current value/error/loading callbacks or form action state depending on final server function pattern.
  - UI: greeting “Bạn muốn xây storefront như thế nào?”, short description, textarea with provided placeholder, primary CTA “Tạo storefront”.
  - Behavior: button submit, disabled/loading state, error display, prevents whitespace-only submit, handles long prompt wrapping.

### Project Workspace Components

- `ProjectList`
  - Renders projects, empty/loading/error states.
  - Owns list semantics and passes selection events upward.

- `ProjectListItem`
  - Shows project name, description or initial prompt summary, status, updated time.
  - Clear selected visual state.

- `ProjectMessagesPanel`
  - Renders chronological messages for selected project.
  - Includes empty/loading/error states.
  - Does not own file explorer or project list state.

- `MessageBubble`
  - Distinguishes `user` and `agent` roles with alignment, labels “Bạn” and “Agent”, and token-compliant surfaces.
  - Renders safe plain text by default; do not render raw HTML.

- `MessageComposer`
  - Textarea + send button.
  - Disables while sending, blocks empty messages, clears only after success.
  - Preserves draft when switching UI panels; project switching should not unexpectedly erase the draft unless explicitly reset for a different selected project.

- `EmptyState`, `LoadingState`, `ErrorState`
  - Shared presentation components aligned with `DESIGN.md` tokens.
  - Error states include retry affordance where relevant.

## File/Folder Explorer UI Plan

### Components

- `ProjectFileExplorer`
  - Separate component from messages.
  - Receives selected project ID, file tree data, selected node ID, and selection callbacks.
  - Displays loading, empty, and error states for tree loading.

- `ProjectFileTreeNode`
  - Recursively renders folder and file nodes.
  - Shows different visuals/icons for folders and files.
  - Supports nested folders and files.
  - Applies selected state for the active node.
  - Handles long names with wrapping/truncation rules that do not break layout.

- `FilePreviewPanel` or `FileMetadataPanel`
  - Shows selected file content preview when safe/plain content exists.
  - Shows metadata for folders or binary/asset placeholders.
  - Never renders raw HTML from file content.

### Rendering Folder Tree

- Render recursively from root-level `ProjectFileNode[]` where `parentId` is absent/null.
- Folders display a disclosure state if collapsible behavior is included in MVP; otherwise nested children can be shown expanded by default for simplicity.
- Files are leaf nodes and selection targets.
- Icons may use text glyphs or token-styled badges initially to avoid adding dependencies.

### Selected Node State

- Store selected node ID in the `/projects` workspace route state or query state alongside selected project.
- Reset selected node when selected project changes unless the same node exists in the new project.
- Project selection must not erase message draft unless required to avoid cross-project send mistakes; prefer per-project draft map for safety if simple.

### Explorer States

- **Loading**: token-styled skeleton or compact status while tree loads.
- **Empty**: friendly explanation that no storefront files/folders exist yet.
- **Error**: recoverable error state with retry.
- **Selected**: black ink/pill or bordered selected state using `DESIGN.md` tokens.

### Explorer Responsive Behavior

- Desktop: project list sidebar, explorer column, and message panel visible together.
- Tablet: project list and explorer can narrow; message panel remains primary.
- Mobile: stack sections or use toggles/accordion tabs for Projects, Files, and Messages; no horizontal overflow.

## Projects Route Layout

`/projects` should be a single master-detail workspace:

```text
+--------------------------------------------------------------+
| Project header / workspace controls                          |
+---------------+----------------------+-----------------------+
| Project list  | File/folder explorer | Message history       |
|               | + selected preview   |                       |
|               |                      | Message composer      |
+---------------+----------------------+-----------------------+
```

Mobile/tablet fallback:

```text
+-----------------------------+
| Workspace header            |
| Project selector/list       |
| Files panel toggle/section  |
| Message history             |
| Message composer            |
+-----------------------------+
```

Rules:

- Project list/sidebar and explorer are separate regions.
- Message composer stays visually attached to message panel and remains reachable on small screens.
- Selected project state drives explorer and messages.
- Empty project list shows CTA back to Home.
- Empty selected project area asks the user to choose or create a project.

## DESIGN.md Application Plan

`DESIGN.md` is the source of truth. Implementation should map it into current Tailwind/CSS variables instead of inventing a new style system.

### Tokens to Map

- Colors:
  - `primary`, `on-primary`, `ink`, `canvas`, `inverse-canvas`, `inverse-ink`, `hairline`, `hairline-soft`, `surface-soft`
  - pastel blocks: `block-lime`, `block-lilac`, `block-cream`, `block-pink`, `block-mint`, `block-coral`, `block-navy`
  - accents/semantic: `accent-magenta`, `semantic-success`, `overlay-scrim`

- Typography:
  - `display-xl`, `display-lg`, `headline`, `subhead`, `card-title`, `body-lg`, `body`, `body-sm`, `link`, `button`, `eyebrow`, `caption`

- Radius:
  - `xs`, `sm`, `md`, `lg`, `xl`, `pill`, `full`

- Spacing:
  - `hair`, `xxs`, `xs`, `sm`, `md`, `lg`, `xl`, `xxl`, `section`

### Component Styling Rules

- Buttons use pill shape and token colors from `button-primary`, `button-secondary`, or tertiary text rules.
- Inputs/textareas use `text-input` and focused token rules.
- Panels use white or `surface-soft`, hairline borders, token radius, and editorial black/white hierarchy with pastel blocks used deliberately for emphasis/empty states.
- Message bubbles:
  - User: align/style distinct, likely black primary or pastel block with clear “Bạn” label.
  - Agent: alternate surface, clear “Agent” label.
- Explorer:
  - Use mono/caption tokens for path/metadata labels.
  - Use hairline borders and selected pill/outline treatment.
  - Avoid hardcoded colors outside mapped tokens.

## Data Model Plan

### Project

Minimum UI-facing fields:

```ts
type Project = {
  id: string
  name: string
  description?: string
  initialPrompt: string
  status: 'draft' | 'generating' | 'ready' | 'failed'
  updatedAt: string
  createdAt: string
  pwa: PwaConfig
}
```

Mapping to existing domain:

- `name` can map from `StorefrontProject.name` or `siteTitle`.
- `description` can map from `businessProfile.shortDescription` or `tagline`.
- `initialPrompt` can map from `businessProfile.sourcePrompt` or first user message/generation record prompt.
- `status` may be derived from export/generation state until a dedicated project status exists.

### Message

```ts
type Message = {
  id: string
  projectId: string
  role: 'user' | 'agent'
  content: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
}
```

Persistence options:

- Preferred: add `project_messages` table with columns matching the minimum model.
- Repository: add `ProjectMessageRepository` methods for list/add/update-status.
- Server functions: create/list/send messages through service boundary.

### ProjectFileNode

```ts
type ProjectFileNode = {
  id: string
  projectId: string
  name: string
  type: 'file' | 'folder'
  path: string
  parentId?: string | null
  children?: ProjectFileNode[]
  contentType?: string
  content?: string
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
```

Persistence options:

- Preferred: add `project_file_nodes` table with project ID, parent ID, path, type, content type, content, metadata JSON, timestamps.
- Root folders have `parentId` null.
- Unique constraint should prevent duplicate `projectId + path`.

### PWA Schema

```ts
type PwaConfig = {
  enabled: boolean
  name: string
  shortName: string
  description?: string
  themeColor: string
  backgroundColor: string
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser'
  startUrl: string
  scope: string
  icons: PwaIcon[]
  offlineFallbackEnabled: boolean
}

type PwaIcon = {
  src: string
  sizes: string
  type: string
  purpose?: 'any' | 'maskable' | 'monochrome'
}
```

Default derivation:

- `name`: storefront/project/business name.
- `shortName`: shortened business name within manifest length guidance.
- `description`: project description/tagline.
- `themeColor`: theme primary color if available; otherwise `DESIGN.md` primary or generated brand primary.
- `backgroundColor`: theme background/canvas color if available.
- `display`: default `standalone` when enabled.
- `startUrl`: storefront root path for the generated output.
- `scope`: storefront output scope.
- `icons`: generated/default placeholder icon references when project icons are missing.
- `offlineFallbackEnabled`: false by default unless output has a safe static fallback.

Validation:

- Required strings must be non-empty.
- Colors must be valid CSS colors accepted by the project validator.
- `icons` must include safe sources and sizes when PWA is enabled.
- Do not cache private/API/dynamic data.

## Server Function and Service Boundary Plan

Because clarification requires real database persistence, server functions should call database-backed services. If any database implementation is incomplete, create interface-first services and repository methods in this plan's implementation phase, but do not fall back to client-only mocks for accepted UI flows.

### Project Functions

- `createProjectFromPrompt(prompt: string)`
  - Validates non-empty prompt.
  - Creates persisted project metadata and initial user message.
  - Creates default storefront schema, virtual file tree, and PWA config.
  - Returns created project summary and selected project data.

- `listProjects()`
  - Returns project summaries for current user context.

- `getProjectWorkspace(projectId: string)`
  - Returns project summary, messages, file tree, selected/default file metadata if needed.

### Message Functions

- `listProjectMessages(projectId: string)`
- `sendProjectMessage(projectId: string, content: string)`
  - Persists user message.
  - Creates agent placeholder/mock response if real AI messaging is not in scope.
  - Returns appended messages.

### File Tree Functions

- `getProjectFileTree(projectId: string)`
- `getProjectFileNode(projectId: string, nodeId: string)`

No create/rename/delete file operations are in scope.

### PWA Functions/Services

- `deriveDefaultPwaConfig(project)`
- `validatePwaConfig(config)`
- `buildPwaVirtualFiles(project)`
- `generatePwaManifest(project)`
- `generateServiceWorker(project)` if exporter scope is implemented

## Functional Flow Plan

### Flow 1: Create Project From Home

1. User opens `/`.
2. Home renders greeting, product description, prompt textarea, and CTA.
3. User enters prompt and submits.
4. Client blocks whitespace-only prompt before submission.
5. Server function validates prompt and persists:
   - project metadata,
   - initial user message,
   - assistant placeholder/message,
   - virtual file tree,
   - PWA config defaults,
   - project revision where applicable.
6. UI shows loading while pending.
7. On success, navigate to `/projects` and select the created project in workspace state/query state.
8. On error, show error and preserve prompt for retry.

### Flow 2: Select Project and Show Messages

1. `/projects` loader/server function loads project summaries.
2. If no projects, show empty state and Home CTA.
3. User selects a project in `ProjectList`.
4. Workspace loads selected project messages, file tree, and default selected file/folder metadata.
5. Selected project item is visually highlighted.
6. Messages render chronologically with user/agent labels and distinct styles.
7. File explorer renders independently of message panel.

### Flow 3: Send New Message

1. User types message in `MessageComposer`.
2. Empty/whitespace content is blocked.
3. While sending, composer is disabled and sending state appears.
4. Server function persists user message and creates/returns assistant response or placeholder.
5. UI appends returned messages to the panel.
6. Composer clears after success only.
7. On failure, show error and preserve typed message.

### Flow 4: Select File/Folder

1. User selects a file or folder in `ProjectFileExplorer`.
2. Selected node ID updates workspace state/query state.
3. `ProjectFileTreeNode` shows selected visual state.
4. `FilePreviewPanel` displays safe plain content or metadata.
5. Folder selection shows folder metadata/children summary.
6. Missing content or unsupported content type shows metadata rather than unsafe preview.

## Loading, Empty, and Error States

- Home creation:
  - Loading: button disabled, progress label.
  - Error: visible retryable error, prompt preserved.

- Project list:
  - Loading: sidebar skeleton/status.
  - Empty: friendly no-projects message and Home CTA.
  - Error: retry action.

- Selected workspace:
  - Empty selected project: prompt to select/create project.
  - Loading selected project: workspace panel status.
  - Error selected project: retry/select another project.

- Messages:
  - Empty: friendly message history empty state.
  - Sending: composer disabled and pending state.
  - Error: message send error without losing draft/history.

- File explorer:
  - Loading tree: compact status/skeleton.
  - Empty tree: no generated files/folders yet.
  - Error tree: retry.
  - Empty preview: select a file/folder.

- PWA:
  - Invalid config: validation error attached to output preparation, not dashboard crash.
  - Missing icons: safe default/placeholder references.

## PWA Export/Publish Pipeline Plan

PWA setup belongs to generated storefront output only.

### Schema Scope

- Add `pwa: PwaConfig` to `StorefrontProject` schema/types.
- Validate PWA config via Zod when project is saved and before output preparation.
- Include PWA defaults in project creation.

### Virtual File Representation

If exporter implementation is not completed in this feature, represent PWA artifacts in the virtual project file tree:

```text
storefront/
├── manifest.webmanifest
├── service-worker.js
├── offline.html
└── assets/
    └── icons/
        ├── icon-192.png
        └── icon-512.png
```

### Exporter Scope

If implementing exporter changes in this feature, extend output pipeline with:

- `manifest.webmanifest` generation when `pwa.enabled = true`.
- `service-worker.js` generation or service worker registration only for generated storefront output.
- Placeholder icons copied/generated safely when brand icons are missing.
- Minimal service worker strategy:
  - cache app shell/static assets,
  - optional offline fallback page,
  - never cache private/API/dynamic data,
  - do not break preview/local development.

### Feature Flag

- `pwa.enabled` controls whether PWA files are required/generated.
- Disabled PWA config must not block normal preview/output.

## Verification Commands

Existing scripts from `package.json`:

- Dev: add/confirm a `dev` script during TanStack Start setup; expected future command `pnpm dev`.
- Typecheck: `pnpm typecheck`.
- Lint: `pnpm lint` currently runs `tsc --noEmit`.
- Test: `pnpm test`.
- Build: `pnpm build` currently runs `tsc --noEmit`; update to real TanStack Start build if scaffold requires it while preserving typecheck coverage.

Manual checks after implementation:

- `/` renders Home greeting, prompt, CTA, loading/error states.
- Creating a project persists data and navigates/selects project in `/projects`.
- `/projects` renders project list/sidebar, file/folder explorer, messages, and composer.
- Project selection shows selected state and loads messages/files.
- Explorer shows nested folders/files, selected node state, empty/loading/error states.
- File/folder selection shows safe metadata or preview content.
- Message sending blocks empty input, appends user/agent messages, handles loading/error.
- Small screen layout stacks/toggles panels without overflow.
- PWA config exists on persisted project schema.
- If exporter changes are included, `manifest.webmanifest` is generated when PWA is enabled.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Current app is Vite-style, not TanStack Start | Route implementation may conflict with requested framework | Migrate foundation first; create `src/routes`; do not preserve incompatible route scaffolding |
| Real database persistence required but repositories are incomplete | UI flows blocked or tests become brittle | Extend Drizzle schema/repositories before UI wiring; keep service interfaces narrow and test with controlled database/fakes only at repository boundary |
| Master-detail route lacks deep project URL | Refresh/share behavior may be weaker | Use query state for selected project if needed while keeping route path `/projects` |
| DESIGN.md token set larger than current Tailwind config | Hardcoded style drift | Expand CSS variables/Tailwind theme mapping before component styling |
| Explorer and messages become coupled | Workspace components become hard to test | Keep `ProjectFileExplorer` and `ProjectMessagesPanel` independent with route-level orchestration |
| PWA accidentally affects builder dashboard | Dashboard caching/manifest bugs | Keep PWA schema/export under storefront output pipeline only; no builder service worker changes |
| Raw message/file preview content could execute HTML | Security issue | Render plain text or sanitized/basic formatting only; never use raw HTML rendering |
| Mobile workspace becomes crowded | MVP usability failure | Use stacking/toggles and keep composer reachable; verify no horizontal overflow |
| TanStack Start docs/API versions may change | Build errors or route mismatch | Verify against installed package docs/API at implementation time and rely on official docs, not invented patterns |

## Phase 0 Research

See [research.md](./research.md).

## Phase 1 Design

See [data-model.md](./data-model.md), [contracts/service-boundaries.md](./contracts/service-boundaries.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

- **Routing Gate**: PASS — design artifacts require `src/routes` file-based routing and no manual route-tree edits.
- **Server Boundary Gate**: PASS — contracts define server functions/services instead of client-only mocks.
- **Persistence Gate**: PASS — data model requires database-backed project/message/file/PWA persistence.
- **Design Gate**: PASS — quickstart and plan require `DESIGN.md` token mapping before UI styling.
- **Security Gate**: PASS — data model and contracts prohibit raw HTML rendering and secret exposure.
- **PWA Boundary Gate**: PASS — PWA is limited to storefront schema/export artifacts.
- **Responsive Gate**: PASS — responsive behavior is included in layout and manual verification.
