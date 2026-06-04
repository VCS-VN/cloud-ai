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
- The AI Agent can update normal route files, components, styles, providers, and service hooks when the user request requires it.
- If a user asks for a protected-file change, explain briefly that the Builder owns that file and continue with safe project files when possible.
