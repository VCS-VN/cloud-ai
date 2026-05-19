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
`;

export function composeDesignMarkdown(visualMarkdown: string): string {
  return `${visualMarkdown.trimEnd()}\n\n---\n\n${STOREFRONT_DESIGN_STATIC_SECTIONS}`;
}
