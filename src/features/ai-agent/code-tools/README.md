# Code Tool Runtime

The code tool runtime is the backend-owned boundary between provider-suggested code actions and generated project files.

## Responsibilities

- Bind every tool call to trusted message context.
- Require project inspection before mutation.
- Keep all paths relative to the active generated project workspace.
- Apply source changes through guarded patches or create-file operations.
- Snapshot before mutation and support rollback.
- Run allowlisted validation commands only.
- Stream sanitized progress events without private reasoning, secrets, full files, raw patches, or full logs.

## Main Modules

- `code-tool-registry.server.ts`: tool definitions, phase allowlists, and provider schema conversion.
- `code-tool-executor.server.ts`: inspection gates, risk checks, soft argument normalization, and structured tool results.
- `code-tool-loop.server.ts`: validation and bounded repair flow helpers.
- `services/`: workspace, path, patch, snapshot, validation, risk, preview, and redaction policies.
- `tools/`: provider-callable project tools backed by services.

## Storefront Apply-By-Default Runtime Expectations

For project detail prompts normalized to apply mode, the runtime must behave as a storefront code worker rather than a generic chat assistant:

- Start with trusted backend-bound project context; never accept model-supplied project identity.
- Inspect before mutation with `project_get_context`, `project_get_file_tree`, and relevant search/read operations.
- Continue with an implicit implementation plan when thinking output has acceptance criteria but no explicit action plan.
- Prefer minimal patches that preserve existing storefront stack, components, cart/product behavior, and brand direction.
- Run validation after mutation or return a specific validation blocker.
- Stream sanitized progress only; do not expose hidden reasoning, raw provider instructions, secrets, full files, or generic clarification for low-risk storefront prompts.
