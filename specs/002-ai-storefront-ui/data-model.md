# Data Model: AI Storefront UI

## Project

Represents a storefront workspace created from a user prompt.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Stable project identifier |
| `name` | string | yes | Display name; may derive from storefront title |
| `description` | string | no | Short summary or tagline |
| `initialPrompt` | string | yes | Prompt that created the project |
| `status` | `draft | generating | ready | failed` | yes | UI-facing project state |
| `createdAt` | ISO datetime | yes | Creation timestamp |
| `updatedAt` | ISO datetime | yes | Last update timestamp |
| `pwa` | `PwaConfig` | yes | Per-storefront PWA configuration |

Relationships:

- Project has many `Message` records.
- Project has many `ProjectFileNode` records.
- Project has one `PwaConfig` embedded in storefront schema or persisted project data.
- Project maps to existing `StorefrontProject` domain model where possible.

Validation:

- `name`, `initialPrompt`, `createdAt`, and `updatedAt` must be non-empty.
- `initialPrompt` cannot be whitespace-only.
- `status` must be one of the allowed states.

## Message

Represents a user or agent conversation entry for a project.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Stable message identifier |
| `projectId` | string | yes | Parent project |
| `role` | `user | agent` | yes | Determines visual treatment |
| `content` | string | yes | Safe plain text content |
| `status` | `pending | completed | failed` | yes | Message lifecycle state |
| `createdAt` | ISO datetime | yes | Chronological ordering timestamp |

Relationships:

- Message belongs to one Project.
- Project creation creates at least one user message containing `initialPrompt`.
- Agent placeholder/response messages also belong to the same Project.

Validation:

- `content` cannot be whitespace-only.
- Raw HTML must not be rendered from content.
- Messages display ordered by `createdAt` ascending.

State transitions:

- `pending` → `completed` when send/response succeeds.
- `pending` → `failed` when send/response fails.
- `failed` may be retried by creating a new send attempt or updating status according to implementation tasks.

## ProjectFileNode

Represents a virtual storefront file or folder generated for a project.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Stable node identifier |
| `projectId` | string | yes | Parent project |
| `name` | string | yes | File or folder name |
| `type` | `file | folder` | yes | Determines icon/behavior |
| `path` | string | yes | Unique path within project |
| `parentId` | string/null | no | Null for root nodes |
| `children` | `ProjectFileNode[]` | no | UI tree form only; can be assembled from rows |
| `contentType` | string | no | MIME/content hint |
| `content` | string | no | Safe preview content when available |
| `metadata` | object | no | Size, generated source, section mapping, etc. |
| `createdAt` | ISO datetime | yes | Creation timestamp |
| `updatedAt` | ISO datetime | yes | Last update timestamp |

Relationships:

- Node belongs to one Project.
- Folder nodes may have child nodes.
- File nodes are leaves.

Validation:

- `projectId + path` should be unique.
- Folder paths and child parent relationships must be consistent.
- File preview content must be displayed safely as text or metadata.
- No create/rename/delete operation is in MVP scope.

Default virtual structure:

```text
storefront/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── assets/
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
└── src/
    ├── sections/
    │   ├── Hero.tsx
    │   ├── ProductGrid.tsx
    │   └── FAQ.tsx
    └── data/
        └── storefront.json
```

## PwaConfig

Per-project configuration for installable generated storefront output.

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `enabled` | boolean | yes | `true` or product default |
| `name` | string | yes when enabled | storefront/business name |
| `shortName` | string | yes when enabled | shortened business name |
| `description` | string | no | project description/tagline |
| `themeColor` | CSS color string | yes when enabled | theme primary color |
| `backgroundColor` | CSS color string | yes when enabled | theme background/canvas color |
| `display` | enum | yes when enabled | `standalone` |
| `startUrl` | string | yes when enabled | storefront root |
| `scope` | string | yes when enabled | storefront scope |
| `icons` | `PwaIcon[]` | yes when enabled | placeholder/default icons if missing |
| `offlineFallbackEnabled` | boolean | yes | `false` unless safe fallback exists |

Validation:

- Required fields must be present when `enabled = true`.
- Colors must be valid CSS color values accepted by schema validation.
- Icon entries must have safe relative/static `src`, valid sizes, and type.
- PWA config must not imply caching private/API/dynamic data.

## PwaIcon

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `src` | string | yes | Static/relative icon path |
| `sizes` | string | yes | Example: `192x192` |
| `type` | string | yes | Example: `image/png` |
| `purpose` | `any | maskable | monochrome` | no | Defaults to `any` |

## Database Additions

Existing tables cover projects/revisions/generation/preview tokens. Add or extend tables for this feature:

- `project_messages`
  - `id`, `project_id`, `role`, `content`, `status`, `created_at`.
- `project_file_nodes`
  - `id`, `project_id`, `name`, `type`, `path`, `parent_id`, `content_type`, `content`, `metadata`, `created_at`, `updated_at`.
- Store PWA config in `storefront_projects.data` as part of validated storefront schema, unless implementation tasks choose a dedicated table for query needs.

## Derived Defaults

- Project name derives from generated storefront title or business name.
- Description derives from tagline or business profile summary.
- Initial prompt derives from prompt submission and is also stored as the first user message.
- PWA config derives from storefront/project/business/theme data.
- Virtual file tree derives from storefront schema and PWA config.
