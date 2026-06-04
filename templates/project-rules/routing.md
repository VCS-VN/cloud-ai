---
rule: routing
---
# Project Routing Rules

- The storefront uses TanStack Start and TanStack Router.
- Page route files use `createFileRoute("/path")({ component: ComponentName })`.
- The root route uses `createRootRoute({ component: Root, notFoundComponent: NotFound })`.
- Product detail uses `createFileRoute("/products/$productId")` and `Route.useParams()`.
- Product index uses a trailing slash route: `createFileRoute("/products/")`.
- `src/routeTree.gen.ts` is a system-generated router file. The AI Agent must not read, create, edit, patch, delete, or rename it.
- The Builder/init system may create or regenerate `src/routeTree.gen.ts`.
- `src/routeTree.gen.ts` may use TanStack-style relative imports such as `./routes/index` and `./routes/products/$productId`.
- Agent-authored route and component files should use `@/...` for internal app imports.
