# Implementation Notes: AI Storefront UI

**Task**: T001 - Inspect repo and DESIGN.md  
**Date**: 2026-05-04  
**Scope**: Read-only repo/design inspection plus convention notes for future tasks.

## Package and Scripts

Current `package.json` defines:

- `pnpm lint` → `tsc --noEmit`
- `pnpm typecheck` → `tsc --noEmit`
- `pnpm test` → `vitest`
- `pnpm build` → `tsc --noEmit`

There is no `pnpm dev` script yet. Future TanStack Start setup must add/confirm the correct dev script before manual route verification tasks can use it.

Current dependencies are Vite/React/Vitest/Drizzle/Postgres/Zod/Tailwind-oriented. TanStack Start/TanStack Router dependencies are not present yet.

## Routing Convention Observed

Current route files live under `app/routes`:

- `app/routes/index.tsx`
- `app/routes/projects.tsx`
- `app/routes/projects..tsx`
- `app/routes/projects.admin.tsx`
- `app/routes/preview.tsx`

`src/routes` does not exist yet. This conflicts with the feature plan, which requires TanStack Start file-based routing in `src/routes` and no manual edits to generated route tree files.

Future route work should:

- Create TanStack Start routes under `src/routes`.
- Treat current `app/routes` files as temporary placeholders/migration references.
- Avoid editing `routeTree.gen` or any generated route tree file by hand.
- Use TanStack Router navigation APIs instead of `window.location` for feature navigation.

## Style System Observed

Current style setup:

- `tailwind.config.ts` includes a small subset of design colors: `ink`, `canvas`, `lime`, `lilac`, `cream`, `mint`, `pink` and `pill` radius.
- `app/styles/globals.css` defines a small subset of CSS variables: `--color-ink`, `--color-canvas`, `--color-lime`, `--color-lilac`, `--color-cream`, `--radius-pill`.
- No component library usage was found in the inspected UI route/component snippets, although `components.json` exists.

`DESIGN.md` is the source of truth and includes a broader token set:

- Colors: primary/on-primary, ink/canvas, inverse tokens, hairline tokens, surface-soft, multiple pastel blocks, magenta accent, success, overlay.
- Typography: display, headline, subhead, body, link, button, eyebrow, caption tokens based on `figmaSans`/`figmaMono`.
- Radius: xs, sm, md, lg, xl, pill, full.
- Spacing: hair, xxs, xs, sm, md, lg, xl, xxl, section.
- Component rules for buttons, text input, tabs, tags, cards, and color-block sections.

Future styling work should map `DESIGN.md` tokens into Tailwind/CSS variables and must not modify `DESIGN.md`.

## Data and Service Layers Observed

Existing database/domain files:

- `src/db/schema.ts` has Drizzle tables for `storefront_projects`, `project_revisions`, `generation_records`, and `preview_tokens`.
- `src/projects/repositories.ts` defines `ProjectRepository`, `PreviewTokenRepository`, and `InMemoryProjectRepository`.
- `src/projects/project-service.ts` creates projects through `GenerationService` and saves project/revision records.
- `src/storefront/types.ts` and `src/storefront/schema.ts` already define the main storefront project schema/type family.

Missing for this feature:

- UI-facing `Project`, `Message`, `ProjectFileNode`, `PwaConfig`, and `PwaIcon` types in the planned feature module.
- Database schema/repository support for persisted project messages.
- Database schema/repository support for virtual file nodes.
- TanStack Start server function boundaries for project, message, and file tree UI flows.
- PWA config integration into storefront schema/output boundary.

## Guardrails for Future Tasks

- Do not integrate a real AI provider in this UI feature.
- Do not use client-only mock state as the accepted persistence layer for project/message/file/PWA flows.
- Mock/seed helpers may be used only for deterministic defaults or tests.
- Do not implement real filesystem access or file CRUD for the explorer.
- Do not render raw HTML from messages or file previews.
- Keep PWA files and service worker behavior scoped to generated storefront output, not the builder dashboard.
- Ensure service worker placeholder avoids caching private API, user, or dynamic sensitive data.
- Keep loading, empty, and error states explicit in Home, Projects, Messages, and Explorer.
- Keep user and agent messages visually distinct and labeled.
- Ensure mobile/tablet layout remains usable after the explorer is added.

## T001 Verification

No test command required by task definition. Findings are documented in this file for review.
