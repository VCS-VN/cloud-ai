# Data Model: Axios HTTP Client Setup

## Entity: Generated HTTP Client File

**Purpose**: Shared request client created during project initialization.

**Fields**:
- `path`: fixed generated path `src/services/http/client.ts`
- `exports`: shared client instance, normalized error class/helper, request defaults, response handling
- `dependencies`: environment accessor and optional auth token helpers if available in generated source

**Validation Rules**:
- Must use import alias rules for cross-folder imports.
- Must not import from preview runtime or host application files.
- Must expose a single reusable request client for generated project code.

## Entity: Environment Template

**Purpose**: Documents configurable HTTP fields for generated storefront projects.

**Fields**:
- `path`: `.env.example`
- `apiBaseUrl`: backend endpoint placeholder used by generated HTTP client
- optional auth-related placeholders only when required by the generated client contract

**Validation Rules**:
- Must not contain real secrets.
- Must be safe to commit and inspect.
- Must align with the field names consumed by generated source.

## Entity: Package Registry Entry

**Purpose**: Ensures generated projects include axios in dependency metadata.

**Fields**:
- `name`: `axios`
- `version`: `^1.16.0`
- `installType`: `dependencies`
- `reason`: HTTP client support

**Validation Rules**:
- Must remain unique in generated dependency maps.
- Must be reflected in generated `package.json`.

## Entity: Initialization Prompt Segment

**Purpose**: Gives the project-detail code agent a focused instruction after shadcn component generation.

**Fields**:
- `title`: HTTP client setup
- `sequence`: runs after shadcn component setup guidance
- `requiredFiles`: `src/services/http/client.ts`, `.env.example`
- `requiredDependency`: axios `^1.16.0`

**Validation Rules**:
- Must be separate from UI component instructions.
- Must require tool-based file creation/patching when used by the code agent.
- Must avoid preview lifecycle instructions.

## State Transitions

1. `Project created` → initial source generation starts.
2. `Infrastructure files generated` → package manifest includes axios and environment template is available.
3. `Storefront baseline generated` → shadcn-style components exist.
4. `HTTP client scaffold generated` → `src/services/http/client.ts` is available for project-detail requests.
5. `Validation complete` → generated project can typecheck without affecting preview runtime.
