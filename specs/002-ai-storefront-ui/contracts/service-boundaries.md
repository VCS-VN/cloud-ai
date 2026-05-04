# Service Boundary Contracts: AI Storefront UI

These contracts describe server-side boundaries for route loaders/actions/server functions. Names are planning-level and may be adapted to exact TanStack Start syntax during implementation.

## Project Service

### `createProjectFromPrompt(input)`

Input:

```ts
{
  prompt: string
}
```

Output:

```ts
{
  project: Project
  messages: Message[]
  fileTree: ProjectFileNode[]
}
```

Rules:

- Reject whitespace-only prompt.
- Persist project through database-backed repository.
- Persist initial user message.
- Persist agent placeholder/response if real response is not available.
- Create default PWA config.
- Create virtual file tree, including PWA files when enabled.

### `listProjects()`

Output:

```ts
{
  projects: Project[]
}
```

Rules:

- Return projects for current user context.
- Sort by `updatedAt` descending unless later product decision changes ordering.

### `getProjectWorkspace(input)`

Input:

```ts
{
  projectId: string
}
```

Output:

```ts
{
  project: Project
  messages: Message[]
  fileTree: ProjectFileNode[]
  selectedNode?: ProjectFileNode
}
```

Rules:

- Return not-found error for unknown project.
- Do not expose secrets or raw provider credentials.

## Message Service

### `listProjectMessages(input)`

Input:

```ts
{
  projectId: string
}
```

Output:

```ts
{
  messages: Message[]
}
```

Rules:

- Messages are ordered by `createdAt` ascending.

### `sendProjectMessage(input)`

Input:

```ts
{
  projectId: string
  content: string
}
```

Output:

```ts
{
  appendedMessages: Message[]
}
```

Rules:

- Reject whitespace-only content.
- Persist user message.
- Persist agent placeholder/response if available.
- Return recoverable errors without deleting existing messages.

## File Tree Service

### `getProjectFileTree(input)`

Input:

```ts
{
  projectId: string
}
```

Output:

```ts
{
  fileTree: ProjectFileNode[]
}
```

Rules:

- Return nested tree form for UI.
- Return empty array if project has no file/folder nodes.

### `getProjectFileNode(input)`

Input:

```ts
{
  projectId: string
  nodeId: string
}
```

Output:

```ts
{
  node: ProjectFileNode
}
```

Rules:

- Return metadata/content for preview panel.
- Never return content intended to be rendered as raw HTML.

## PWA Service

### `deriveDefaultPwaConfig(project)`

Output: `PwaConfig`

Rules:

- Derive name/shortName/description/colors from project/business/theme data.
- Use safe placeholder icons if custom icons are missing.

### `validatePwaConfig(config)`

Output:

```ts
{
  valid: boolean
  errors: string[]
  warnings: string[]
}
```

Rules:

- Required manifest fields must be valid when enabled.
- Disabled config must not block normal output.

### `buildPwaVirtualFiles(project)`

Output:

```ts
{
  nodes: ProjectFileNode[]
}
```

Rules:

- Include `manifest.webmanifest` when `pwa.enabled = true`.
- Include `service-worker.js` or equivalent only for generated storefront output.
- Include placeholder icon nodes when needed.

### `generatePwaManifest(project)`

Output:

```ts
{
  fileName: 'manifest.webmanifest'
  content: string
}
```

Rules:

- Content is JSON manifest text.
- Generated only when `pwa.enabled = true`.

## UI State Contract

- `/projects` stores selected project in route-local state or query state.
- `/projects` stores selected file/folder node in route-local state or query state.
- Message draft should not be lost when toggling explorer/project panels.
- If changing selected project, prevent accidentally sending a draft to the wrong project; a per-project draft map is acceptable.
