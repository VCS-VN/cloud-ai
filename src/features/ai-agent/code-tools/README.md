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
