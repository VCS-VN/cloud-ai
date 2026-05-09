# Contract: Code Tool Runtime

## Tool Execution Invariant

Every provider-requested tool call is executed through the backend with trusted message context. Provider arguments are untrusted and may not define project identity, workspace root, permissions, or stream identity.

## Tool Categories

- `inspect`: reads safe project context or source information.
- `mutate`: changes project source through guarded patch or create-file operations.
- `validate`: runs allowlisted project validation checks.
- `snapshot`: creates or restores rollback checkpoints.
- `preview`: synchronizes preview runtime when backend policy requires it.

## Common Tool Result

```json
{
  "ok": true,
  "data": {},
  "warnings": [],
  "metadata": {
    "toolName": "project_read_file",
    "category": "inspect",
    "projectId": "project_123",
    "messageId": "msg_456",
    "durationMs": 18
  }
}
```

Failure shape:

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN_PATH",
    "message": "Requested path is not allowed.",
    "recoverable": true
  },
  "metadata": {
    "toolName": "project_read_file",
    "category": "inspect",
    "projectId": "project_123",
    "messageId": "msg_456",
    "durationMs": 4
  }
}
```

## Required Tools

### project_get_context

**Category**: inspect

**Purpose**: Return safe project state summary, stack, package policy, route conventions, and workspace metadata.

**Input**:

```json
{
  "includeRecentChanges": true,
  "includePackagePolicy": true,
  "includePreviewStatus": true
}
```

**Output Data**:

- `summary`: project summary.
- `stack`: stack labels.
- `recentChanges`: optional safe recent change summaries.
- `packagePolicy`: optional safe dependency/script policy.
- `previewStatus`: optional preview health summary.

### project_get_file_tree

**Category**: inspect

**Input**:

```json
{
  "root": "",
  "maxDepth": 4
}
```

**Rules**:

- `root` must be project-relative or empty.
- Excludes dependency, build, cache, secret, and binary-heavy paths.

### project_search_code

**Category**: inspect

**Input**:

```json
{
  "query": "ProductCard wishlist",
  "globs": ["src/**/*.{ts,tsx}"],
  "maxResults": 12
}
```

**Rules**:

- Search output is snippet-based, redacted, and size-limited.
- Missing matches are recoverable.

### project_read_file

**Category**: inspect

**Input**:

```json
{
  "path": "src/components/ProductCard.tsx",
  "maxBytes": 80000
}
```

**Rules**:

- Path must be project-relative and safe.
- Output includes content, checksum, line count, and truncation metadata.
- Secret-like values are redacted.

### project_read_file_range

**Category**: inspect

**Input**:

```json
{
  "path": "src/components/ProductCard.tsx",
  "startLine": 1,
  "endLine": 80
}
```

**Rules**:

- Range is inclusive and must be positive.
- Output is redacted and truncated if needed.

### project_create_snapshot

**Category**: snapshot

**Input**:

```json
{
  "reason": "Before applying wishlist button patch"
}
```

**Rules**:

- Required before first mutation.
- Snapshot identity is stored in message run state.

### project_apply_patch

**Category**: mutate

**Input**:

```json
{
  "patch": "--- a/src/components/ProductCard.tsx\n+++ b/src/components/ProductCard.tsx\n...",
  "reason": "Add wishlist button to product card",
  "expectedChangedFiles": ["src/components/ProductCard.tsx"]
}
```

**Rules**:

- Requires successful inspection.
- Requires snapshot before first mutation.
- Blocks unsafe paths, forbidden files, protected generated artifacts, oversized patches, too many files, unsafe package changes, and secret-like additions.
- Streams only patch summary to client.

### project_create_file

**Category**: mutate

**Input**:

```json
{
  "path": "src/components/WishlistButton.tsx",
  "content": "...",
  "reason": "Create reusable wishlist button"
}
```

**Rules**:

- Fails if path already exists.
- Uses same path and secret safety checks as patching.

### project_run_validation

**Category**: validate

**Input**:

```json
{
  "commands": ["npm run typecheck", "npm run lint", "npm run build"],
  "reason": "Validate code changes"
}
```

**Rules**:

- Commands must be allowlisted.
- Output is summarized, redacted, and truncated.
- Missing project scripts are recoverable or skipped.

### project_get_diff

**Category**: inspect

**Input**:

```json
{
  "includePatch": false,
  "maxBytes": 20000
}
```

**Rules**:

- Returns changed file summary and optionally bounded patch content for provider use only.
- Client receives safe summary, not full raw patch.

### project_rollback_snapshot

**Category**: snapshot

**Input**:

```json
{
  "snapshotId": "snap_123",
  "reason": "Validation failed after repair attempts"
}
```

**Rules**:

- Restores snapshot created for the current message run.
- Cross-message or cross-project snapshot rollback is blocked.

## Phase Tool Allowlist

- Bootstrap/planning: inspect tools only.
- Mutation: inspect tools, snapshot creation, patch, create file, and diff.
- Validation: validation, diff, and inspect tools.
- Repair: inspect tools, patch, validation, diff, and rollback.

## Hard Blocks

- Unsafe path or path traversal.
- Absolute path.
- Forbidden file or directory.
- Unknown tool.
- Disallowed phase.
- Mutation before inspection.
- Validation command outside allowlist.
- Patch touching protected generated files.
- Broad destructive or high-risk change requiring review.
