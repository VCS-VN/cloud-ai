# Research: AI Storefront UI

## Decision: Migrate to TanStack Start `src/routes` before UI implementation

**Rationale**: The feature explicitly requires TanStack Start and file-based routing. The current repo has temporary `app/routes` files and Vite scripts, so implementing the MVP there would create incompatible routing work and later rework.

**Alternatives considered**:

- Keep current `app/routes`: rejected because it conflicts with clarified TanStack Start requirement.
- Add `/projects/$projectId`: rejected for MVP because clarification selected `/projects` master-detail workspace.

## Decision: Use official TanStack Start route/server boundaries

**Rationale**: TanStack Start expects file-based route definitions and generated route-tree output. Server logic should be isolated in supported server functions/loaders/actions and route-tree generated files should not be edited manually.

**Alternatives considered**:

- Manual route tree edits: rejected because generated files must be tooling-owned.
- Direct `window.location`: rejected for normal navigation because TanStack Router navigation is available.

## Decision: Database-backed project/message/file/PWA flows

**Rationale**: Clarification requires real database persistence for UI flows. Existing Drizzle schema and project repository interfaces provide a starting point, but message/file/PWA persistence must be added.

**Alternatives considered**:

- Client-only mocks: rejected by clarification.
- In-memory repository only: useful for tests but insufficient as the accepted product flow.

## Decision: `DESIGN.md` tokens mapped into Tailwind/CSS variables

**Rationale**: `DESIGN.md` defines color, typography, spacing, radius, and component tokens. The repo already has Tailwind and CSS variables, so the safest approach is expanding the existing mapping rather than adding a competing style system.

**Alternatives considered**:

- Plain CSS only: rejected because Tailwind already exists and can carry token utilities.
- Component library: rejected for MVP because no current dependency requires it and it risks visual drift.

## Decision: Separate file explorer component and data service

**Rationale**: The explorer is a distinct workspace panel and should not be mixed into message rendering. A dedicated file tree type/service keeps UI testable and allows future replacement with generated schema or real export files.

**Alternatives considered**:

- Embed files in messages: rejected because it couples unrelated UI concerns.
- Real filesystem operations: rejected because create/rename/delete are out of MVP scope.

## Decision: PWA belongs to storefront schema/export only

**Rationale**: The generated storefront needs manifest/service-worker/icon support, but the builder dashboard must not receive PWA side effects. Keeping PWA under `StorefrontProject` schema and export services avoids accidental dashboard caching or manifest behavior.

**Alternatives considered**:

- Apply PWA to dashboard: rejected by scope.
- Hosting-provider-specific PWA pipeline: rejected because export pipeline should stay replaceable.

## Decision: Responsive support is MVP scope

**Rationale**: The accepted clarification requires mobile/responsive behavior now. The workspace can use stacking or toggles on small screens to preserve usability without building a full mobile-specific product.

**Alternatives considered**:

- Desktop-only MVP: rejected by clarification.
- Only overflow prevention: insufficient because all panels must remain usable.
