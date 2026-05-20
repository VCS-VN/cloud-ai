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

## Storefront Design Authoring Pipeline

The runtime collaborates with the `storefront-design-authoring` skill (see `.agents/skills/storefront-design/SKILL.md`) to author and protect the per-project DESIGN.md.

- Skill artifact: `.agents/skills/storefront-design/SKILL.md` — defines section index, role catalog, vibe selection rules, anti-template-leak rules, page rhythm, and iteration rules. Carries no concrete token values.
- Generation: `services/design-generation-service.server.ts` reads `buildStructuralOutline()` (no concrete values) and runs the LLM, then validates structural shape and anti-template-leak; retries once with feedback; falls back to heuristic on persistent failure.
- File service: `services/design-file-service.server.ts` composes static sections 9-13 and writes DESIGN.md.
- Token extractor: `services/design-token-extractor.server.ts` parses DESIGN.md into a `ProjectTokenIndex` (palette / fonts / radii / shadows + role lookup).
- Anti-template-leak validator: `services/design-template-leak-validator.server.ts` extracts the sensitive value set from the structural reference template at runtime; runs only inside generation (init / redesign), never on `loadProjectDesignRules` so legacy projects are not retroactively failed.
- Patch-content validator: `services/design-patch-content-validator.server.ts` scans every UI mutation diff for hex / rgb / hsl / oklch / font-family / radius / shadow literals; values must map to the project's declared tokens or to the neutral whitelist.
- Token patch service: `services/design-rule-patch-service.server.ts` patches named role bullets in DESIGN.md without regenerating; never synthesizes new roles.

## Design Intent Routing

Heuristic in `planning/design-intent-heuristic.ts` classifies each prompt into one of four labels:

- `init` — project status `empty`. Orchestrator runs the init workflow which calls `generateAndWriteDesignFile` and forwards `tokenHints` extracted from the prompt.
- `update_no_design` — no design markers. Orchestrator skips DESIGN.md mutation entirely and goes straight into the agentic loop.
- `update_token` — concrete token values present (hex / rgb / quoted font / explicit role-value verb). Orchestrator calls `applyTokenPatches`, emits `design_file_token_patched`, and prompts the agent with `buildTokenPatchRewritePrompt(...)` to update only UI surfaces that read the patched roles.
- `redesign` — vibe / direction markers present. Orchestrator calls `generateAndWriteDesignFile` with `tokenHints` honored by the anti-leak validator, then prompts the agent with `buildRedesignRewritePrompt(prompt, tokenHints)`.

Ambiguous `update_token` prompts (no concrete value) emit a `clarification_required` event with code `DESIGN_PATCH_AMBIGUOUS_TOKEN_REQUEST`. Missing roles for the requested patch produce `DESIGN_PATCH_TOKEN_ROLE_NOT_FOUND` with a redesign suggestion.

## Error Codes

Defined in `services/design-error-codes.ts`:

- `DESIGN_FILE_MISSING` — DESIGN.md absent from workspace.
- `DESIGN_RULES_REQUIRED` — UI mutation attempted before `project_read_design_rules` was called.
- `DESIGN_TEMPLATE_LEAK` — generated DESIGN.md reused values from the structural reference template (after retry).
- `DESIGN_TOKEN_LITERAL_OFF_RULE` — UI patch literal not declared in project DESIGN.md (retryable).
- `DESIGN_PATCH_AMBIGUOUS_TOKEN_REQUEST` — token-level update prompt missing a concrete value.
- `DESIGN_PATCH_TOKEN_ROLE_NOT_FOUND` — requested role not declared in DESIGN.md.
- `DESIGN_PATCH_STRUCTURE_BROKEN` — patch would break the 8-section contract.
