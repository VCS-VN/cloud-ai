---
rule: protected-files
---
# Protected And System-Owned Files

- The AI Agent must not read, create, edit, patch, delete, or rename generated project `.env` files:
  - `.env`
  - `.env.local`
  - `.env.production`
  - `.env.development`
  - `.env.*`
- The Builder app process owns generated project environment values.
- The AI Agent must not edit generated lockfiles.
- The AI Agent must not edit `src/routeTree.gen.ts`; it is owned by the Builder/TanStack router generation flow.
- The AI Agent must not create, rewrite, patch, delete, or rename `src/routes/__root.tsx` during normal build or edit turns. It is Builder-owned app-shell plumbing and is pre-seeded with the required style import, `<Providers>` wrapper, `<Outlet />`, and `<Scripts />`.
- The AI Agent can update normal route files under `src/routes/**` except `src/routes/__root.tsx`, plus components, styles, providers, and service hooks when the user request requires it.
- The only editable pre-seeded style file is `src/styles/app.css`; if edited, keep the Tailwind directives first and preserve the `DESIGN_TOKENS_START` / `DESIGN_TOKENS_END` marker region.
- If a user asks for a protected-file change, explain briefly that the Builder owns that file and continue with safe project files when possible.
