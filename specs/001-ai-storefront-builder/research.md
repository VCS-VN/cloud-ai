# Research: AI Storefront Builder

## Decision: Use a single TanStack Start application

**Rationale**: The repository is new and V1 needs one cohesive product surface for prompt entry, editing, preview, admin/operator inspection, and server-side actions. A single app keeps setup minimal while still allowing clear server/client boundaries.

**Alternatives considered**:
- Separate frontend/backend: stronger isolation but unnecessary setup overhead for V1.
- Static generator only: simpler export but insufficient for editing, persistence, and operator workflows.

## Decision: Use PostgreSQL with Drizzle ORM

**Rationale**: The clarified requirement mandates server-side persistence with PostgreSQL and Drizzle. This supports saved projects, generation history, revisions, and preview token lifecycle while keeping schema typed.

**Alternatives considered**:
- In-memory storage: fails saved/reopen requirement.
- Local files: less suitable for admin/operator views and future multi-user workflows.

## Decision: Start with preview URL mode as the only output provider

**Rationale**: Preview URLs satisfy V1 output while avoiding provider-specific deployment coupling. Draft preview can render from persisted revisions and later share the same provider abstraction as static export or deployment.

**Alternatives considered**:
- Static export first: useful but more artifact handling and less aligned with live editing flow.
- Real deploy provider first: higher risk and secret/config complexity.

## Decision: Use an extensible section schema with required common metadata

**Rationale**: The user selected extensible custom sections. Required common fields keep validation, editing, rendering, and regeneration safe while permitting future templates/themes.

**Alternatives considered**:
- Fixed section enum only: easiest to validate but limits AI/template flexibility.
- Fully free-form sections: unsafe and hard to render/test.

## Decision: Real AI provider behind an interface

**Rationale**: V1 requires a real provider, but generation must remain replaceable. An interface allows deterministic fake providers for tests and prevents provider-specific coupling in project data/rendering.

**Alternatives considered**:
- Real provider called directly from UI/actions: fastest initially but hard to test and replace.
- Mock-only provider: safer for tests but fails V1 requirement for real generation.

## Decision: Preserve user edits by default during regeneration

**Rationale**: Regeneration should improve targeted content without losing user work. Tracking source/edit metadata and merging by target scope enables safe defaults and explicit overwrite behavior.

**Alternatives considered**:
- Replace full section/page every time: simpler but violates acceptance criteria.
- Manual conflict resolution UI in V1: more control but too much scope for MVP.

## Decision: Use environment variables for provider and database configuration

**Rationale**: `.env` supports local setup while keeping real secrets out of source. Deployed environments should use equivalent secret storage.

**Alternatives considered**:
- Store provider keys in database/admin UI: unnecessary risk for V1.
- Hardcoded provider config: violates secret and provider abstraction requirements.
