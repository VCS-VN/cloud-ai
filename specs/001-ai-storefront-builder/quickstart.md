# Quickstart: AI Storefront Builder

## Prerequisites

- Node.js LTS compatible with TanStack Start
- PostgreSQL available locally or through a connection string
- Real AI provider key for local generation

## Environment

Create an uncommitted `.env` file from `.env.example`:

```text
DATABASE_URL=postgres://user:password@localhost:5432/cloud_ai
AI_PROVIDER=your-provider
AI_MODEL=your-model
AI_API_KEY=your-api-key
AI_BASE_URL=
AI_TIMEOUT_MS=60000
```

Rules:
- Commit `.env.example` only with placeholders.
- Do not commit `.env` with real keys.
- Do not print keys in logs, UI, or operator views.

## Local Development Flow

1. Install project dependencies after scaffold is created.
2. Configure `.env` with database and AI provider values.
3. Run database migrations.
4. Start the TanStack Start dev server.
5. Create a storefront project from a natural-language prompt.
6. Generate storefront data with the real provider.
7. Open the preview URL and verify draft indicator, desktop layout, and mobile layout.
8. Edit text/product/theme/sections and save.
9. Regenerate one section and verify unrelated manual edits remain unchanged.
10. Inspect operator view for prompt, structured output, validation errors, generation history, and current project state with secrets redacted.

## Preview Mode Guidance

- Preview route format should be stable, e.g. `/preview/$previewToken`.
- Preview token resolves to a persisted project revision, not live mutable editor state.
- Preview page displays a draft/preview badge.
- Preview uses the same renderer and structured data as the editor.
- Editing or regeneration creates a new revision; preview token policy should be explicit in tasks: either update active token to latest revision or create revision-specific tokens.

## Validation Commands

Exact commands depend on scaffolded package scripts, but tasks should establish:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Live AI tests should be skipped by default when `AI_API_KEY` is absent.
