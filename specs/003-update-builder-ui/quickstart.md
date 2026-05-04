# Quickstart: Builder Pages UI Refresh

## Prerequisites

- Install dependencies with the existing package manager used by the repository.
- Work from branch `003-update-builder-ui`.
- Use `DESIGN.md` as the visual token reference.

## Implementation Walkthrough

1. Review the current target files:
   - `src/routes/index.tsx`
   - `src/routes/projects.tsx`
   - `src/components/home/HomePromptForm.tsx`
   - `src/components/projects/*.tsx`
   - `src/components/common/*.tsx`
   - `app/styles/globals.css`
2. Refresh the home page first:
   - Replace technical welcome copy with friendly website-building language.
   - Make the prompt area compact and visually central.
   - Add simple prompt guidance/examples if needed.
3. Refresh projects management:
   - Introduce a left vertical sidebar menu.
   - Put searchable project listing on the right.
   - Add no-project and no-search-results states.
4. Refresh project detail:
   - Move chat into the right-side panel.
   - Add a top Preview/Code switch in the main output area.
   - Keep selected project identity and next action visible.
5. Compact component sizing:
   - Reduce oversized headings, card padding, list item spacing, and panel chrome where needed.
   - Keep DESIGN.md tokens as the source but apply them at builder-appropriate scale.
6. Verify supported responsive widths:
   - iPad landscape/tablet width.
   - Common laptop width.
   - Large desktop width.

## Validation Commands

```bash
pnpm lint
pnpm build
```

## Visual QA Checklist

- Home page clearly says users can build a website by describing an idea.
- Projects page has left navigation, right project list, and search.
- Project detail has main Preview/Code area and right chat panel.
- Components feel smaller and tidier than the current broken UI.
- No horizontal overflow from iPad/tablet width upward.
- Empty, loading, and error states are readable and compact.
