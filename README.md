# AI Storefront Builder

TanStack Start-style TypeScript storefront builder scaffold for generating, validating, editing, saving, and previewing AI-created storefront projects.

## Local Setup

1. Install dependencies: `pnpm install`
2. Copy `.env.example` to `.env`
3. Set `DATABASE_URL`, `AI_PROVIDER`, `AI_MODEL`, and `AI_API_KEY`
4. Run checks with `pnpm lint`, `pnpm typecheck`, `pnpm test -- --run`, and `pnpm build`

## AI Provider

Provider code is accessed through `AIProvider` in `src/ai/ai-provider.ts`. Real secrets are read from environment variables and must never be committed or logged.

## Preview Mode

V1 output is preview URL mode. Preview URLs resolve a token to a persisted project revision and render a draft storefront from structured data.
