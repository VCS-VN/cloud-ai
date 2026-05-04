# Quickstart: AI Storefront UI

## Prerequisites

- Node.js LTS compatible with TanStack Start.
- pnpm installed.
- PostgreSQL connection planned for production database-backed flows.
- No real secrets committed; use `.env.example` placeholders only.

## Verified Commands

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Verified during implementation:

- `pnpm typecheck` passes.
- `pnpm lint` passes; currently aliases `tsc --noEmit`.
- `pnpm test` passes with 5 test files and 14 tests.
- `pnpm build` passes with TanStack Start/Vite client and SSR output.
- `pnpm dev` starts the TanStack Start dev server on localhost.

## Implemented Routes

- `/` — Home prompt flow with greeting, prompt textarea, loading/error state, create CTA, and TanStack Router navigation to `/projects`.
- `/projects` — master-detail workspace with project list, virtual file/folder explorer, file metadata/preview panel, message history, and message composer.

Route files live in `src/routes`. Do not manually edit `src/routeTree.gen.ts`.

## Implemented Data Boundary

- UI-facing types: `src/features/storefront-builder/types.ts`.
- Project/message/file tree services: `src/features/storefront-builder/*-service.ts`.
- Server functions: `src/server/functions/projects.ts`, `src/server/functions/project-messages.ts`, `src/server/functions/project-files.ts`.
- Repository contracts: `src/projects/repositories.ts`.
- Drizzle schema additions: `src/db/schema.ts`.

`src/features/storefront-builder/mock-store.ts` provides deterministic seed/default helpers. It is not intended as a long-term client-only persistence layer.

## Implemented UI Components

- `HomePromptForm`
- `ProjectList`
- `ProjectListItem`
- `ProjectMessagesPanel`
- `MessageBubble`
- `MessageComposer`
- `ProjectFileExplorer`
- `ProjectFileTreeNode`
- `FilePreviewPanel`
- `EmptyState`
- `LoadingState`
- `ErrorState`

## PWA Notes

PWA setup is scoped to generated storefront output only.

- `PwaConfig` and `PwaIcon` are defined in storefront schema/types.
- Virtual file tree includes `manifest.webmanifest`, `service-worker.js`, and placeholder icons when `pwa.enabled = true`.
- `src/export/pwa-exporter.ts` provides `generatePwaManifest`, `generateServiceWorker`, and `collectPwaAssets` boundaries.
- Service worker placeholder avoids private API/user data caching.

## Manual Verification Checklist

- Home route renders greeting “Bạn muốn xây storefront như thế nào?”.
- Prompt input uses the requested placeholder and wraps long prompts.
- Successful create navigates to `/projects` with selected project query state.
- `/projects` shows project list, selected project, file explorer, message panel, and composer.
- Messages distinguish “Bạn” and “Agent”.
- Composer blocks empty messages and clears after success.
- Explorer shows nested folders/files and selected state.
- File preview renders safe text/metadata only; no raw HTML rendering.
- Mobile/tablet layout stacks panels without horizontal overflow.
- PWA files appear only for enabled PWA config.
