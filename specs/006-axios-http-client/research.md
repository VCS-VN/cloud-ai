# Research: Axios HTTP Client Setup

## Decision: Add HTTP client scaffold to initial generated source

**Rationale**: The current generated storefront already centralizes package selection in `src/features/ai-agent/source/package-registry.ts` and initial files in `src/features/ai-agent/source/init-source.server.ts`. Adding the HTTP client file to the generated source keeps the behavior repeatable for every new project and avoids relying on project-detail edit flows after creation.

**Alternatives considered**:
- Patch projects only after creation through the edit agent: rejected because new projects would briefly exist without the required HTTP client baseline.
- Keep the legacy scaffold in `src/agent/project-workspace-service.ts`: rejected for this feature because current project creation uses the source generation flow and package registry.

## Decision: Create `src/services/http/client.ts` in generated projects

**Rationale**: User requested a dedicated `services/http/client.ts` location. This path separates transport concerns from UI, store, and route files while remaining easy for project-detail follow-up tasks to discover.

**Alternatives considered**:
- `src/lib/axios-instance.ts`: already exists in the legacy scaffold, but the requested path is clearer and aligns with a services-oriented HTTP layer.
- Inline HTTP setup in route files: rejected because it duplicates interceptor and error handling logic.

## Decision: Keep axios pinned through package registry at `^1.16.0`

**Rationale**: The root project already declares axios `^1.16.0`, and the generated project package registry already includes axios `^1.16.0`. Planning should preserve exact current registry behavior and ensure tests assert the generated package manifest includes axios at that version.

**Alternatives considered**:
- Use `latest`: rejected because reproducibility and the user specifically requested axios version 1.16.
- Add a runtime package-install command tool: rejected for initial generation because generated package manifests are the source of truth; install execution belongs to workspace dependency installation, not code generation.

## Decision: Generate a safe local environment template

**Rationale**: Code-tool safety currently blocks editing `.env` and `.env.*` files through project mutation tools. For initialization, generated files are controlled by the scaffold, so a non-secret `.env.example` is safer and documents required fields without storing secrets.

**Alternatives considered**:
- Generate `.env`: rejected because mutation policies explicitly treat `.env` files as high risk and real local values can contain secrets.
- No environment file: rejected because the feature requires discoverable environment keys.

## Decision: Do not modify preview runtime flow

**Rationale**: Preview behavior lives in runtime/process/presence services and project detail preview controls. The HTTP client setup belongs to generated project source and package metadata; preview should only consume the generated files as before.

**Alternatives considered**:
- Restart preview automatically after adding client files: rejected because this plan targets project initialization, not preview lifecycle changes.

## Code Review Graph

**Decision**: Attempted to use `code-review-graph` first per constitution, then continued with source search because the MCP tool returned `unsupported call` in this session.

**Rationale**: Static review identified the relevant files without changing behavior:
- `src/features/ai-agent/source/init-source.server.ts`
- `src/features/ai-agent/source/package-registry.ts`
- `src/features/ai-agent/source/package-json-generator.ts`
- `src/features/ai-agent/source/import-alias-validator.ts`
- `src/features/ai-agent/code-tools/code-agent-prompts.server.ts`
- `src/features/ai-agent/code-tools/code-tool-registry.server.ts`
- `src/features/ai-agent/runtime/process-manager.server.ts`
- `src/features/ai-agent/runtime/presence-service.server.ts`
- `src/routes/projects/$projectId.tsx`
