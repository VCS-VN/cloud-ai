---
name: "storefront-design-authoring"
description: "Author and maintain a project-specific retail storefront design rule set (DESIGN.md) using a structural template and role-based tokens. Generate a unique, project-fit visual identity per project; never copy concrete token values from the structural reference template."
compatibility: "Cloud-AI builder pipeline (design-pipeline.server.ts via design-generation-service.server.ts; manifest at projects/<id>/blocks.json)"
metadata:
  author: "cloud-ai"
  version: "2.0.0"
---

## 1. Purpose

This skill is the AUTHOR of the per-project storefront design rule set (`DESIGN.md` inside the generated project workspace). Each project receives its own rule set, generated once at init from the user prompt + extracted website spec, and then KEPT STABLE across subsequent updates.

Apply this skill when the agent must:

- Generate the initial DESIGN.md for a brand-new project (`init` intent).
- Produce a fresh DESIGN.md when the user explicitly requests a redesign of overall vibe / palette / typography (`redesign` intent).
- Patch a small set of named tokens in an existing DESIGN.md (`update_token` intent done by the design-rule-patch-service; this skill describes the constraints that patch must obey).

This skill is NOT a per-prompt UI rewriter. UI patches happen elsewhere; this skill governs the rule SET those patches must respect.

## 2. Section index (8 mandatory sections)

The generated DESIGN.md MUST contain exactly these 8 sections, in this order, using these heading lines verbatim (the structural validator depends on it):

```
## 1. Visual Theme & Atmosphere
## 2. Color Palette & Roles
## 3. Typography Rules
## 4. Spacing System
## 5. Radius, Shadow & Motion
## 6. Component Styling
## 7. Layout Principles
## 8. Responsive Behavior
```

Sections 9-13 are appended automatically by the builder pipeline; do NOT author them here.

## 3. Role catalog

For each section the rule set MUST declare at least the following ROLES. Role names are semantic guidance; the project rule set may use equivalent names as long as every listed responsibility is covered. Concrete token values (hex, font literal, rem/px) are chosen per project; do NOT hard-code values inside this skill body.

### Section 2 - Color Palette & Roles

| Role | Responsibility |
|---|---|
| primary brand | Strong brand anchor for headings, important highlights, selected states |
| accent brand | Main CTA color - primary buttons, cart actions, key commerce affordances |
| deep surface | Dark feature band / footer surface for high-impact promotional sections |
| page canvas | Default global page background |
| card surface | Primary card and modal surface |
| section surface | Section background, separators, soft utility zones |
| text on light | Main text on light backgrounds |
| text on light muted | Metadata, descriptions, muted copy |
| text on dark | Main text on dark backgrounds |
| text on dark muted | Secondary copy on dark sections |
| error | Error / destructive states |
| warning | Warning / attention states |
| success | Valid form state or success surface |

Optional roles when the vibe calls for them: premium accent, premium surface, sale tint, gradient stop. When declared, they too live in section 2 with concrete values.

### Section 3 - Typography Rules

- A primary font-family stack with system fallbacks. Choose ONE primary family that fits the chosen vibe.
- Hierarchy MUST cover: display, hero, h1, h2, h3, body large, body, small, micro. Each row declares size, weight, line-height. Use a clear hierarchy; never collapse two rows into the same triple.

### Section 4 - Spacing System

- A scale named `space-1` through `space-9` (or equivalent) with monotonically increasing values.
- Mobile / tablet / desktop gutters explicitly listed.

### Section 5 - Radius, Shadow & Motion

- Radius roles: input, card, pill, optional circle.
- Shadow roles: card, nav, floating. Each role gets one concrete shadow declaration.
- Motion: press feedback, default transition, optional accordion.

### Section 6 - Component Styling

- Buttons: primary filled, primary outlined, dark surface filled, dark surface outlined. Each variant references roles from sections 2 / 5.
- Product card: visual area, name, price, badge / sale, CTA, optional wishlist, optional rating.
- Header / nav: brand, navigation, cart affordance, optional search / account.
- Hero section: headline, subcopy, primary CTA, optional secondary CTA, visual area.
- Product grid: column counts per breakpoint.
- Feature band: dark promotional band rules.
- Forms: input radius, validation tints, submit shape.
- Optional floating cart CTA.

### Section 7 - Layout Principles

- Container max-width and gutters per breakpoint.
- Section padding scale and whitespace philosophy.
- Page rhythm (see section 6 below).

### Section 8 - Responsive Behavior

- Named breakpoints (>=5 named tiers, e.g. XS / Mobile / Tablet / Desktop / XL).
- Hero, product grid, feature band, gutter behavior per tier.
- Touch target minimums.

## 4. Vibe selection rules

Pick ONE coherent vibe per project and apply it consistently across all 8 sections.

Common vibes (open list, not exhaustive; pick the closest fit, do not default):

- minimalist
- luxury
- playful
- organic / natural
- streetwear
- tech / cyber
- premium / refined
- friendly / approachable
- editorial
- bold / maximalist
- handcrafted
- retro / vintage

Selection guidance:

1. Read the user prompt + extracted store metadata (store type, products, brand tone, target customers).
2. Pick the vibe whose connotations best match the products and target audience.
3. If the prompt mixes contradictory cues, choose the vibe that best serves the COMMERCE goal (selling products) and document the choice in section 1 of the DESIGN.md.
4. Vibe drives palette saturation, typography character (geometric vs humanist vs serif), spacing density, radius style (sharp vs soft vs full pill), and shadow weight.

When the user prompt names specific colors / fonts (for example a hex value or a quoted font name), HONOR those values in the matching role and complete the rest in a way that stays coherent with the vibe.

## 5. Anti-template-leak rules

Project DESIGN.md MUST NOT copy concrete token values from the structural reference template `templates/storefront/basic-ecommerce/DESIGN.md`. The reference template exists to illustrate STRUCTURE only.

- The validator extracts the sensitive value set from the reference template at runtime; if the generated rule set repeats a sensitive hex / font / radius / shadow value, the pipeline retries; on a second failure it falls back to a heuristic generator and the pipeline does NOT persist the leaked output.
- Exception: if the user prompt explicitly names a specific value, and that value happens to match the reference template, the validator honors the user choice for the matching role.

Authors of this skill artifact MUST NOT include any concrete hex, font literal, or unit-bearing radius value here either; this skill describes shapes only.

## 6. Page rhythm (default storefront layout)

Generated storefronts default to this rhythm; deviations are allowed only when the user explicitly requests them:

```
Header / Navigation
 -> Hero section
 -> Category, benefit, or promotional strip
 -> Featured product grid
 -> Feature or campaign band
 -> Trust signals, testimonials, or reviews
 -> Newsletter, offer, or final CTA
 -> Footer
```

## 7. Iteration rules (init / update_no_design / update_token / redesign)

The orchestrator routes incoming prompts to one of four design-intent labels. This skill defines the expected behavior for each.

### `init`

- Author a fresh DESIGN.md for the new project from prompt + website spec.
- Choose ONE vibe, declare every required role with concrete project-specific values.
- Pass the structural validator (8 sections) AND the anti-template-leak validator before persisting.

### `update_no_design`

- Do NOT author or rewrite DESIGN.md.
- Do NOT regenerate any section.
- The orchestrator will not invoke this skill on this path; it exists here as a constraint reminder.

### `update_token`

- The orchestrator (not this skill body, but the patch service it commissions) replaces only the named token values inside their existing role bullets.
- Structure (8 sections), role catalog, and all unmentioned values remain bit-stable.
- The hash of DESIGN.md changes because content changed; that is expected and propagated via `designSourceHash`.

### `redesign`

- Author a brand-new DESIGN.md, replacing the previous one.
- Honor any concrete tokens the user explicitly named in the redesign prompt.
- Pass both validators before persisting.
- The UI rewrite that follows is performed by other agents using this new DESIGN.md as their single source of truth.

This skill is framework-agnostic. Stack-specific rules (Tailwind, shadcn/ui, TanStack, etc.) live in stack-implementation documents and are intentionally out of scope here.

## 8. Block Library + Manifest (v2)

Version 2 introduces a per-project design manifest persisted at `<projectWorkspace>/blocks.json`. The manifest captures the full project composition (the ordered list of selected blocks with their chosen variant ids, tier classification, and slot position) plus the project vibe metadata (descriptor + 1-2 anchors + story). It is the single source of truth that downstream UI generation reads when it needs to resolve which blocks render where.

DESIGN.md Section 1 ("Visual Theme & Atmosphere") MUST use a strict bullet structure so the manifest extractor can parse it deterministically:

- `**Descriptor:**` one short phrase naming the vibe.
- `**Anchors:**` 1-2 anchor names drawn from the bounded reference pool.
- `**Story:**` two to three sentences explaining how the vibe serves the storefront.

Variant selection follows a signal-first + seed tiebreak protocol: high-impact blocks (hero, feature band, primary CTA bands) request an AI rank of the top three eligible variants and a deterministic seed-pick chooses among them; supporting blocks skip the AI rank, apply code-level eligibility filters, and seed-pick from the survivors. The seed is per-project so re-runs are stable.

Anchors MUST come from the bounded list at `templates/storefront/vibe-reference-pool.yaml`. The block library at `templates/storefront/block-library.yaml` defines per-block eligibility signals, composition rules (slot, allowed neighbors, mutual exclusions), and the variant catalog.

Intent semantics governing manifest writes: `init` creates the manifest, `update_token` mutates only design tokens (manifest untouched), `update_no_design` skips both DESIGN.md and the manifest, `redesign` replaces both DESIGN.md and the manifest, and `shake_design` reshuffles variant selections inside the existing block list using a new seed.
