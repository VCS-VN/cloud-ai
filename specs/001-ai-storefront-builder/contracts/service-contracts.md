# Contracts: Core Services

## ProjectService

Responsibilities:
- Create project from prompt input.
- Load saved project and current revision.
- Save user edits as project revision.
- Provide operator project state view with secrets redacted.

## GenerationService

Responsibilities:
- Build prompts from normalized project context.
- Call `AIProvider`.
- Parse structured output.
- Validate schema and safety.
- Merge accepted output into project state.
- Create `GenerationRecord` for success or failure.

## ValidationService

Responsibilities:
- Validate storefront schema.
- Normalize missing product fields with safe placeholders.
- Reject invalid/custom sections that cannot satisfy fallback rendering requirements.
- Return actionable errors and warnings.

## EditingService

Responsibilities:
- Apply explicit edit operations.
- Track user-edited fields.
- Reorder/add/delete sections.
- Preserve manual edits during regeneration unless overwrite is explicit.

## PreviewService

Responsibilities:
- Create and resolve preview tokens.
- Bind preview URLs to persisted project revisions.
- Return renderable project data for preview route.
- Mark preview output as draft, not published.

## OutputProvider

V1 implementation: `PreviewUrlProvider`.

Future implementations:
- Static export provider
- Deployable build provider
- Hosted publishing provider
