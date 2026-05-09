# Quickstart: Code Tool Calling Runtime

## Prerequisites

- Active feature pointer: `.specify/feature.json` points to `specs/011-code-tool-runtime`.
- Dependencies installed with the repository package manager.
- Database connection configured for local development.
- Generated project fixture or existing generated project available for message-run testing.

## Planning Verification

1. Review `specs/011-code-tool-runtime/spec.md` for user scenarios and acceptance criteria.
2. Review `specs/011-code-tool-runtime/research.md` for key safety decisions.
3. Review `specs/011-code-tool-runtime/data-model.md` for persistent and runtime entities.
4. Review contracts in `specs/011-code-tool-runtime/contracts/` before creating implementation tasks.

## Implementation Workflow

1. Add code-tool runtime types, registry, executor, event mapper, and prompt module.
2. Add read-only inspection tools and tests first.
3. Add path guard integration and forbidden file policy tests before mutation tools.
4. Add snapshot and patch tools with rollback tests.
5. Add validation allowlist and repair loop tests.
6. Integrate code tool loop into the message runner after thinking layer output.
7. Persist tool execution logs and message run state.
8. Add preview restart-required policy after patch result calculation.
9. Update stream reducer/UI handling only for sanitized event types if needed.

## Required Checks

Run targeted tests first, then broad checks:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Manual Acceptance Scenarios

### Safe inspection before mutation

1. Submit a message requesting a small storefront UI change.
2. Confirm stream shows context/search/read activity before any patch event.
3. Confirm no mutation tool succeeds before inspection succeeds.

### Path escape blocked

1. Simulate a provider tool call for `../other-project/src/App.tsx`.
2. Confirm tool result is blocked with a recoverable safety error.
3. Confirm no external file is read or modified and the client stream remains open.

### Patch and validation

1. Submit a request that changes a known component.
2. Confirm snapshot creation occurs before patch application.
3. Confirm changed file summary is streamed without raw patch content.
4. Confirm validation status appears in the final run summary.

### Human review trigger

1. Submit a request to delete the source tree or switch the storefront foundation.
2. Confirm no automatic mutation occurs.
3. Confirm `human_review_required` is streamed with a safe reason.

## Rollback Check

1. Force validation failure after mutation in a controlled fixture.
2. Confirm bounded repair attempts occur.
3. Confirm rollback or human-review final state is recorded when repair is exhausted.

## Implementation Notes Added During Runtime Wiring

- Code-tool progress is now emitted around the existing incremental update path so clients can consume sanitized context, snapshot, patch, validation, preview, and completion events.
- The runner serializes message executions per project with a project-level mutation lock.
- The OpenAI provider exposes a Responses API helper for function-tool requests and matching tool outputs; deeper autonomous provider-loop adoption can iterate on the same adapter.
- Project state helpers can append code change records and merge file manifest entries after generated project mutations.
