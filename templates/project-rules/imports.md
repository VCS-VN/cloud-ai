---
rule: imports
---
# Project Import Rules

- For agent-authored storefront source, prefer the `@/...` alias for imports inside `src`.
- Do not use legacy `~/...` imports.
- Do not use long relative internal imports such as `../../components/...` in routes or components.
- Allowed system-generated exceptions:
  - `src/router.tsx` may import `./routeTree.gen`.
  - `src/routeTree.gen.ts` may import route modules with `./routes/...`.
- Package imports such as `react`, `@tanstack/react-router`, and `lucide-react` stay as package imports.
- CSS must be imported as `@/styles/app.css` from the root route.
