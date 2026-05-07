# Quickstart: AI Streaming Responses

## Prerequisites

- Node and pnpm matching the existing project setup.
- PostgreSQL reachable through `DATABASE_URL`.
- OpenAI API credentials for server-side generation.

## Environment

Add these server-only values to `.env`:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=<model-name>
OPENAI_BASE_URL=
OPENAI_TIMEOUT_MS=60000
```

During migration, the implementation may also read existing `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`, and `AI_TIMEOUT_MS` values as fallbacks. Do not expose API keys to the browser.

## Development Flow

1. Install dependencies if needed:

   ```bash
   pnpm install
   ```

2. Generate and apply the Drizzle migration for:

   - Project processing state.
   - Message lifecycle fields.
   - Agent message chunk table.

   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

3. Run the app:

   ```bash
   pnpm dev
   ```

4. Verify dashboard prompt flow:

   - Log in.
   - Submit a prompt from `/dashboard`.
   - Confirm the app creates the project and user message, redirects immediately to `/projects/$projectId`, and streams the agent response there.

5. Verify project detail prompt flow:

   - Open an owned project.
   - Submit a prompt from the composer.
   - Confirm the user message persists, an agent placeholder appears, project processing state is visible, and response text streams progressively.

6. Verify stop behavior:

   - Submit a prompt that is still streaming.
   - Click stop.
   - Confirm no further text is appended, the partial response remains visible, the message is marked stopped, and project processing returns to idle.

7. Verify failure behavior:

   - Temporarily use invalid provider configuration.
   - Submit a prompt.
   - Confirm the project returns to idle and the failed agent message shows a safe English error state while preserving partial content if any was displayed.

## Required Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Before final review, run code-review graph impact analysis on changed files and inspect the `ProjectDetailPage`, project message functions, message service, repository, and schema flows.

## UI Checklist

- Message bubbles do not exceed the chat panel width.
- Streaming deltas append without shifting the rest of the layout unexpectedly.
- Loading, streaming, stopped, failed, retry, and stop controls use subtle transitions.
- Lucide icons use semantic app icon tokens.
- No raw hex, `text-white`, or `text-black` is introduced in project UI.
- All visible labels and errors are English.
