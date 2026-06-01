import { prependManagedDesignNotice } from "./design-file-contract.server";

export const STOREFRONT_DESIGN_STATIC_SECTIONS = `## 9. Stack Implementation Rules

This project uses:

- TanStack Start
- TanStack Router
- TanStack Query
- TanStack Mutation through \`useMutation\`
- Tailwind CSS v3
- shadcn/ui
- Jotai
- React Hook Form
- Zod

### Implementation Rules

- Use Tailwind CSS v3 utility classes.
- Use shadcn/ui primitives when they improve quality and consistency.
- Use Jotai for local UI state such as cart drawer, wishlist, filters, and selected options.
- Use TanStack Query for async reads.
- Use \`useMutation\` for async write or action flows.
- Use React Hook Form + Zod for forms.
- Do not edit \`src/routeTree.gen.ts\`.
- Reuse existing components before creating new ones.
- Keep patches minimal and focused.
- Validate after code changes.

---

## 10. Agent Prompt Guide

### Iteration Guide

When refining existing screens:

1. Focus on one component or section at a time.
2. Read this \`DESIGN.md\` before changing UI.
3. Preserve the existing storefront direction unless the user asks for redesign.
4. Use design tokens and roles defined in sections 1-8 of this document.
5. Product cards must feel commerce-ready.
6. Keep CTA shapes consistent across the storefront.
7. Validate responsive layout.
8. Avoid rewriting the whole app for a small design request.

---

## 11. Agent Rules

### Init Project Rules

When initializing a project:

- Do not generate a bare demo page.
- Generate a complete retail storefront shell.
- Include header, hero, product grid, trust/benefit section, promotional or feature band, newsletter/final CTA, and footer.
- Use this design system as the source of UI rules.
- Make product cards commerce-ready.
- Use intentional surfaces and consistent spacing.
- Ensure responsive layout works on mobile and desktop.

### Update Project Rules

When updating a project:

- Read \`DESIGN.md\` before modifying UI.
- Inspect current code before patching.
- Apply minimal patches.
- Preserve existing design direction.
- Improve visual completeness if the UI looks like a scaffold.
- Do not ask generic clarification for low-risk UI prompts.
- Do not rewrite the whole storefront unless explicitly requested.
- Validate after changes.

### Code Generation Rules

- Prefer semantic React components.
- Use Tailwind CSS v3 classes.
- Use shadcn/ui where suitable.
- Use Jotai for local UI state.
- Use TanStack Query and \`useMutation\` for async data/actions.
- Use React Hook Form + Zod for forms.
- Do not edit generated router files.
- Keep component code readable and maintainable.

---

## 12. Quality Checklist

A generated or updated storefront should satisfy:

- Header looks like a real retail navigation area.
- Hero has clear retail message, subcopy, CTA, and visual direction.
- Product grid is not a raw scaffold.
- Product cards include visual, name, price, and CTA.
- CTAs are prominent and consistent.
- Trust, benefit, review, or guarantee section exists.
- Footer exists and feels complete.
- Page uses consistent surfaces matching the palette in section 2.
- Spacing and typography are consistent.
- Mobile layout is usable.
- No meaningless empty gray placeholders remain.
- No horizontal overflow.
- Validation passes after code changes.

---

## 13. Known Implementation Notes

- Use public fonts as declared in section 3 (Typography Rules).
- If product images are unavailable, use intentional branded visual placeholders with gradients, icons, labels, or category visuals — not empty gray blocks.
- For real payment, authentication, or external services, require proper configuration and credentials before implementation.
- If shadcn/ui components do not exist yet, create or adapt local components carefully without changing package policy unexpectedly.
- For visual updates, prefer improving existing sections over creating disconnected new sections.

---

## 14. Anti-Slop Guardrails

These guardrails are distilled from an anti-slop frontend taste system, adapted for retail commerce. They are hard rules: generated and updated UI MUST satisfy them.

### Banned patterns

- **No AI-purple/violet default gradients.** Never use generic purple/violet/indigo gradient washes (e.g. \`from-purple-500 to-indigo-600\`) as the default brand look, and never use a centered hero floating over a dark mesh/aurora gradient. Use the declared palette roles instead.
- **No off-palette colors.** Use only declared palette roles (\`primary\`, \`accent\`, \`highlight\`, \`deep\`, plus surface/foreground/semantic roles). Never introduce raw Tailwind color utilities outside the palette (e.g. \`bg-rose-400\`, \`text-emerald-500\`) unless the value matches a declared role token. This is the Color Consistency Lock.
- **No three-equal-card feature rows** in the SaaS-marketing style. NOTE: a product grid of 3-4 product cards is correct and REQUIRED — this ban targets generic "feature/benefit" card triplets, not product listings.
- **No section-numbering eyebrows or decorative version labels** (e.g. "001 · Capabilities", "v2.0"). Eyebrows must carry real retail meaning (category, collection, offer).
- **No fake application UI built from divs.** Do not fabricate fake dashboards, fake browser chrome, or fake app screenshots out of \`<div>\`s. Branded editorial placeholders for missing product images ARE allowed (token-safe gradients, labels, badges, abstract shapes).

### Hero discipline

- Headline: max 2 lines on desktop.
- Subtext: max 20 words / 4 lines.
- Primary CTA visible without scrolling (above the fold).
- Header/nav: single line, max 80px tall.

### Consistency locks

- **One corner-radius system** for the whole storefront (all-sharp, all-soft, or all-pill — see \`radiusLock\` in front-matter). Do not mix radius systems.
- **One theme decision** (see \`themeLock\`). When \`dual\`, support light + dark via the \`.dark\` class and never flip theme mid-page.
`;

export function composeDesignMarkdown(visualMarkdown: string): string {
  return prependManagedDesignNotice(
    `${visualMarkdown.trimEnd()}\n\n---\n\n${STOREFRONT_DESIGN_STATIC_SECTIONS}`,
  );
}
