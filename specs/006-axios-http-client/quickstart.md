# Quickstart: Axios HTTP Client Setup

## Review Scope

1. Inspect source generation files:
   - `src/features/ai-agent/source/init-source.server.ts`
   - `src/features/ai-agent/source/package-registry.ts`
   - `src/features/ai-agent/source/package-json-generator.ts`
2. Inspect code-agent prompt/tool flow:
   - `src/features/ai-agent/code-tools/code-agent-prompts.server.ts`
   - `src/features/ai-agent/code-tools/code-tool-registry.server.ts`
3. Confirm preview files are not modified:
   - `src/features/ai-agent/runtime/process-manager.server.ts`
   - `src/features/ai-agent/runtime/presence-service.server.ts`
   - `src/routes/projects/$projectId.tsx`

## Implementation Checklist

1. Add a focused HTTP client initialization prompt segment that runs after shadcn component guidance.
2. Generate `src/services/http/client.ts` with axios instance, request defaults, response handling, auth recovery, and normalized errors based on the guide code.
3. Generate `.env.example` with the API endpoint key consumed by the client.
4. Ensure generated `package.json` includes `axios` at `^1.16.0`.
5. Add or update tests for generated files and package metadata.
6. Run `pnpm lint` or the project typecheck command after implementation.

## Manual Verification

- Create a new project detail workspace.
- Verify generated files include `src/services/http/client.ts` and `.env.example`.
- Verify generated package metadata includes axios `^1.16.0`.
- Start or inspect preview status to confirm existing preview flow still behaves the same.
