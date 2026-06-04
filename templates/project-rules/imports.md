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
- `src/routes/__root.tsx` MUST begin with exactly these two imports before React, TanStack Router, provider, component, or any other imports: first `import '@vitejs/plugin-react/preamble'`, then `import '@/styles/app.css'`. This order is mandatory so TanStack Start hydration and first-paint storefront CSS load correctly.
- Root route preamble MUST be a valid side-effect import exactly: `import '@vitejs/plugin-react/preamble'`. Never write `@vitejs/plugin-react/preamble` as a bare line, never omit quotes, and never import it as a binding.
- Do not import brand/social icons from `lucide-react` (for example Instagram, Facebook, Twitter/X, LinkedIn, YouTube). `lucide-react@1.14.0` may not export brand icons. For social/contact links use generic Lucide icons that exist in this project such as `Mail`, `MessageCircle`, `Send`, `Globe`, `ExternalLink`, or text labels.
