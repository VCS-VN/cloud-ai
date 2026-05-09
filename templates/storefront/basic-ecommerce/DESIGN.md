# Basic e-Commerce Storefront Design System

## 1. Visual Theme & Atmosphere

This design system is for a **warm, polished, conversion-focused retail storefront**. The storefront should feel complete, trustworthy, and ready for real shopping behavior — not like a bare demo page.

The visual language is built around:

- a warm neutral page canvas;
- clean card surfaces;
- strong but approachable call-to-action buttons;
- generous spacing;
- clear product hierarchy;
- responsive retail layouts;
- soft shadows;
- rounded geometry;
- complete commerce sections such as header, hero, product grid, benefits, trust signals, newsletter, and footer.

The system should work for general retail categories such as cosmetics, fashion, accessories, lifestyle products, electronics, home goods, and single-product landing pages.

### Key Characteristics

- Warm-neutral canvas instead of cold pure white.
- Solid color-block sections instead of random gradients.
- Full-pill buttons with active press feedback.
- Product cards that include real commerce affordances.
- Soft card elevation using low-alpha layered shadows.
- Clear retail page rhythm from header to footer.
- Responsive layout that feels designed on mobile and desktop.
- Typography hierarchy based on weight, spacing, and color, not only large font sizes.
- Trust and conversion sections included by default.
- No empty gray placeholders unless clearly intentional and temporary.

### Page Rhythm

A complete storefront should usually follow this rhythm:

```text
Header / Navigation
→ Hero section
→ Category, benefit, or promotional strip
→ Featured product grid
→ Feature or campaign band
→ Trust signals, testimonials, or reviews
→ Newsletter, offer, or final CTA
→ Footer
```

---

## 2. Color Palette & Roles

### Primary Brand Colors

Use role-based color tokens. A storefront should not use random colors for each section.

Recommended default palette:

- **Primary Brand** (`#006241`): Strong brand anchor. Use for brand moments, headings, important highlights, and selected states.
- **Accent Brand** (`#00754A`): Main CTA color. Use for primary buttons, active states, cart actions, and key commerce affordances.
- **Deep Brand** (`#1E3932`): Dark feature-band and footer surface. Use for high-impact promotional sections.
- **Muted Brand** (`#2B5148`): Secondary dark brand tone for decorative or supporting areas.
- **Light Brand Tint** (`#D4E9E2`): Soft success, selected, or utility tint.

### Accent Colors

- **Premium Gold** (`#CBA258`): Use sparingly for premium, limited, sale, rewards, best-seller, or special-status badges.
- **Gold Light** (`#DFC49D`): Use for subtle premium backgrounds.
- **Gold Surface** (`#FAF6EE`): Use for warm premium sections or soft promotional blocks.

### Surface Colors

- **White** (`#FFFFFF`): Primary card and modal surface.
- **Warm Page Canvas** (`#F2F0EB`): Default global background.
- **Ceramic Surface** (`#EDEBE9`): Section background, separators, or soft utility zones.
- **Quiet Surface** (`#F9F9F9`): Dropdowns, utility cards, muted containers.
- **Dark Surface** (`#1E3932`): Footer, feature band, dark campaign surface.

### Text Colors

- **Text Primary** (`rgba(0, 0, 0, 0.87)`): Main text on light backgrounds.
- **Text Secondary** (`rgba(0, 0, 0, 0.58)`): Metadata, descriptions, muted copy.
- **Text On Dark** (`#FFFFFF`): Main text on dark backgrounds.
- **Text On Dark Secondary** (`rgba(255, 255, 255, 0.70)`): Secondary copy on dark sections.

### Semantic Colors

- **Error** (`#C82014`): Error and destructive states.
- **Warning** (`#FBBC05`): Warning or attention states.
- **Success Tint** (`rgba(212, 233, 226, 0.33)`): Valid form state or success surface.
- **Error Tint** (`rgba(200, 32, 20, 0.05)`): Invalid form state.

### Color Rules

#### Do

- Use warm page canvas for the overall storefront.
- Use the accent brand color for main CTAs.
- Use dark brand surfaces for feature bands and footer.
- Use premium gold only for special status or promotional emphasis.
- Keep product cards on white or very light surfaces.
- Use high contrast for purchase actions.

#### Don't

- Do not use random gradients as the main structure.
- Do not use pure white as the only page background.
- Do not use premium gold everywhere.
- Do not create multiple unrelated CTA colors.
- Do not use pure black body text when a softer text color is available.

---

## 3. Typography Rules

### Font Family

Recommended public fonts:

```css
font-family: Inter, Manrope, Nunito Sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Use one primary sans-serif family across the storefront.

### Hierarchy

| Role | Size | Weight | Line Height | Notes |
|---|---:|---:|---:|---|
| Display | clamp(3rem, 6vw, 5rem) | 700 | 1.05 | Large campaign hero |
| Hero | clamp(2.4rem, 4vw, 3.6rem) | 700 | 1.12 | Main hero title |
| H1 | 2.4rem | 700 | 1.35 | Page title |
| H2 | 2rem | 600 | 1.35 | Section title |
| H3 | 1.35rem | 600 | 1.4 | Card or subsection title |
| Body Large | 1.125rem | 400 | 1.75 | Hero/supporting copy |
| Body | 1rem | 400 | 1.5 | Default copy |
| Small | 0.875rem | 500 | 1.5 | Metadata, badge, label |
| Micro | 0.8125rem | 400 | 1.5 | Captions and helper text |

### Letter Spacing

- Default: `-0.01em`
- Emphasis: `0.1em`
- Uppercase labels: `0.12em` to `0.15em`

### Typography Principles

- Use one primary sans-serif font for consistency.
- Use weight and color to create hierarchy.
- Avoid excessive font-size jumps.
- Keep body copy readable and benefit-led.
- Use concise retail language.
- Do not use decorative fonts in the main shopping flow unless the template specifically calls for it.

---

## 4. Spacing System

Use a consistent spacing scale.

| Token | Value | Typical Use |
|---|---:|---|
| `space-1` | 4px | Tight inline spacing |
| `space-2` | 8px | Small gaps |
| `space-3` | 16px | Default card padding and mobile gutter |
| `space-4` | 24px | Section inner spacing |
| `space-5` | 32px | Major card/section gap |
| `space-6` | 40px | Desktop gutter and large gaps |
| `space-7` | 48px | Section-to-section spacing |
| `space-8` | 56px | Large component height |
| `space-9` | 64px | Large section padding |

### Gutters

- Mobile: `16px`
- Tablet: `24px`
- Desktop: `40px`

### Spacing Rules

- Use generous section padding: `40px` to `64px` on desktop.
- Product cards need enough internal padding for image, title, price, badge, and CTA.
- Do not let content touch viewport edges.
- Separate major sections with whitespace rather than heavy dividers.
- Keep vertical rhythm consistent across the page.

---

## 5. Radius, Shadow & Motion

### Radius

| Value | Use |
|---:|---|
| `8px` | Inputs and small controls |
| `12px` | Cards, modals, product tiles |
| `50px` | Buttons and pill badges |
| `50%` | Circular icons and floating actions |

### Shadows

Use soft layered shadows.

```css
--shadow-card: 0 0 0.5px rgba(0,0,0,0.14), 0 1px 1px rgba(0,0,0,0.24);
--shadow-nav: 0 1px 3px rgba(0,0,0,0.10), 0 2px 2px rgba(0,0,0,0.06), 0 0 2px rgba(0,0,0,0.07);
--shadow-floating: 0 0 6px rgba(0,0,0,0.24), 0 8px 12px rgba(0,0,0,0.14);
```

### Motion

- Button active state: `transform: scale(0.95)`
- Button transition: `all 0.2s ease`
- Image fade-in: `opacity 0.3s ease-in`
- Accordion: `300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`

### Motion Rules

- Motion should feel responsive and subtle.
- Use active press feedback on buttons.
- Do not over-animate product cards or purchase controls.
- Avoid distracting motion in checkout or form flows.

---

## 6. Component Styling

### Buttons

#### Primary Filled

- Background: Accent Brand (`#00754A`)
- Text: White
- Border: `1px solid #00754A`
- Radius: `50px`
- Padding: `0.7rem 1.6rem`
- Font weight: `600`
- Active: `scale(0.95)`
- Transition: `all 0.2s ease`

#### Primary Outlined

- Background: transparent
- Text: Accent Brand
- Border: `1px solid #00754A`
- Radius: `50px`
- Padding: `0.7rem 1.6rem`

#### Dark Surface Primary

Use on dark feature bands:

- Background: White
- Text: Accent Brand or Deep Brand
- Border: White
- Radius: `50px`

#### Dark Surface Secondary

Use on dark feature bands:

- Background: transparent
- Text: White
- Border: `1px solid #FFFFFF`
- Radius: `50px`

### Cards

#### Content Card

- Background: White
- Radius: `12px`
- Shadow: soft layered card shadow
- Padding: `16px` to `24px`

#### Product Card

A product card must include:

- product visual;
- product name;
- price;
- category, badge, or sale state when available;
- CTA such as Add to cart, Quick add, View details;
- optional wishlist action;
- optional rating/review count.

Rules:

- Product image area should look intentional.
- Do not leave empty gray blocks with no context.
- Use consistent aspect ratio.
- Place CTA where users can quickly act.
- Keep price visible and easy to scan.
- Sale or premium badges should be visually distinct but not noisy.

### Header / Navigation

A storefront header should include:

- brand name or logo text;
- navigation links;
- cart affordance;
- optional search or account action;
- responsive mobile menu behavior.

Rules:

- Header must feel like a real retail navigation bar.
- Use subtle shadow or border to separate it from content.
- Keep cart and purchase affordances visible.
- Avoid a header that only contains brand text with no shopping functionality.

### Hero Section

A complete hero must include:

- strong headline;
- short supporting copy;
- primary CTA;
- optional secondary CTA;
- visual area or product/category highlight;
- brand or commerce signal.

Recommended layouts:

- desktop: split layout or campaign block;
- mobile: stacked layout;
- use warm or dark color-block surfaces.

### Product Grid

Recommended columns:

- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 to 4 columns
- Large desktop: up to 5 if product cards remain readable

Rules:

- Product cards must align in a consistent grid.
- Keep spacing between cards generous.
- CTA should be visible without crowding.
- Avoid horizontal overflow.
- Do not stretch product visuals unnaturally.

### Feature Band

Use a dark feature band for:

- promotions;
- limited collections;
- brand story;
- best sellers;
- seasonal campaign;
- trust or loyalty messaging.

Style:

- Background: Deep Brand (`#1E3932`)
- Primary text: White
- Secondary text: White at 70% opacity
- Primary CTA: white-filled pill
- Secondary CTA: white-outline pill

### Forms

Use forms for:

- checkout;
- contact;
- newsletter;
- account;
- lead capture.

Rules:

- Use React Hook Form with Zod for generated forms.
- Show accessible validation errors.
- Use `8px` input radius.
- Use valid/invalid tint states where helpful.
- Keep form layout simple and mobile-friendly.

### Floating Commerce CTA

Use only when it improves conversion, such as:

- cart drawer;
- quick checkout;
- continue order;
- sticky add-to-cart.

Style:

- Size: `56px`
- Shape: circle
- Background: Accent Brand
- Icon: White
- Shadow: floating shadow
- Position: bottom-right
- Active: `scale(0.95)`

---

## 7. Layout Principles

### Storefront Completeness

Generated pages should not look like scaffolds.

A basic retail storefront should include:

1. Header/navigation
2. Hero section
3. Product/category section
4. Product grid
5. Benefit or trust section
6. Promotion or feature band
7. Newsletter or final CTA
8. Footer

### Whitespace Philosophy

Whitespace should make the store feel calm, organized, and premium.

Use:

- generous section spacing;
- consistent card gaps;
- readable max-widths;
- visual grouping through surfaces.

Avoid:

- cramped product grids;
- oversized empty areas;
- cards touching each other;
- content flush to screen edges.

### Grid & Container

- Use a centered max-width container for most sections.
- Use full-width color bands for hero, feature, and footer.
- Use responsive grids for products and categories.
- Use consistent gutters across sections.

---

## 8. Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---:|---|
| XS | `<480px` | Single column, mobile nav, full-width buttons |
| Mobile | `480–767px` | 1–2 column grids where appropriate |
| Tablet | `768–1023px` | 2–3 column grids, hero split may begin |
| Desktop | `1024–1439px` | Full hero split, 3–4 product columns |
| XL | `1440px+` | Larger max-width and optional 5-column grids |

### Responsive Rules

- Hero split collapses into stacked layout on mobile.
- Product grid collapses to one column on small screens.
- Touch targets should be at least `44px` tall on mobile.
- Feature bands stack vertically on mobile.
- Outer gutter scales from `16px` to `24px` to `40px`.
- Do not create horizontal overflow.
- CTA buttons should remain easy to tap.

---

## 9. Stack Implementation Rules

This project uses:

- TanStack Start
- TanStack Router
- TanStack Query
- TanStack Mutation through `useMutation`
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
- Use `useMutation` for async write or action flows.
- Use React Hook Form + Zod for forms.
- Do not edit `src/routeTree.gen.ts`.
- Reuse existing components before creating new ones.
- Keep patches minimal and focused.
- Validate after code changes.

---

## 10. Agent Prompt Guide

### Color Reference

- Primary CTA: Accent Brand (`#00754A`)
- Primary CTA text: White (`#FFFFFF`)
- Brand heading: Primary Brand (`#006241`)
- Feature band / footer: Deep Brand (`#1E3932`)
- Page canvas: Warm Page Canvas (`#F2F0EB`)
- Section surface: Ceramic Surface (`#EDEBE9`)
- Card surface: White (`#FFFFFF`)
- Heading text on light: Text Primary (`rgba(0,0,0,0.87)`)
- Body text on light: Text Secondary (`rgba(0,0,0,0.58)`)
- Body text on dark: Text On Dark Secondary (`rgba(255,255,255,0.70)`)
- Premium / sale / special badge: Premium Gold (`#CBA258`)
- Destructive: Error (`#C82014`)

### Example Component Prompts

1. "Create a primary retail CTA pill button with Accent Brand background, white text, 50px border radius, 0.7rem 1.6rem padding, font weight 600, and scale(0.95) active state."

2. "Create a product card with a white background, 12px radius, soft layered shadow, product visual, name, price, sale/category badge, and Add to cart CTA."

3. "Build a dark feature band with Deep Brand background, white headline, muted white body text, and two pill CTAs: one white-filled and one white-outlined."

4. "Create a responsive product grid that is 1 column on mobile, 2 columns on tablet, and 3–4 columns on desktop. Each card must include commerce-ready actions."

5. "Improve a basic hero section into a complete retail hero with headline, subheadline, primary CTA, secondary commerce signal, and visual product/category area."

6. "Create a newsletter form using React Hook Form and Zod, with accessible error text, 8px input radius, and a pill submit button."

7. "Create a checkout form using React Hook Form, Zod validation, shadcn/ui input primitives, and clear order summary layout."

8. "Create a wishlist interaction using Jotai state and a heart icon button on product cards."

9. "Add a floating cart CTA using a 56px circular button, Accent Brand background, white icon, and soft floating shadow."

10. "Improve mobile layout by increasing touch target sizes, stacking hero content, reducing horizontal overflow, and making CTAs full-width where appropriate."

### Iteration Guide

When refining existing screens:

1. Focus on one component or section at a time.
2. Read this `DESIGN.md` before changing UI.
3. Preserve the existing storefront direction unless the user asks for redesign.
4. Use design tokens and roles from this document.
5. Product cards must feel commerce-ready.
6. Do not introduce random gradients.
7. Keep full-pill CTAs consistent.
8. Use warm canvas and white card surfaces.
9. Validate responsive layout.
10. Avoid rewriting the whole app for a small design request.

---

## 11. Agent Rules

### Init Project Rules

When initializing a project:

- Do not generate a bare demo page.
- Generate a complete retail storefront shell.
- Include header, hero, product grid, trust/benefit section, promotional or feature band, newsletter/final CTA, and footer.
- Use this design system as the source of UI rules.
- Make product cards commerce-ready.
- Use warm page canvas and intentional card surfaces.
- Ensure responsive layout works on mobile and desktop.

### Update Project Rules

When updating a project:

- Read `DESIGN.md` before modifying UI.
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
- Use TanStack Query and `useMutation` for async data/actions.
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
- Page uses warm canvas and consistent surfaces.
- Spacing and typography are consistent.
- Mobile layout is usable.
- No meaningless empty gray placeholders remain.
- No horizontal overflow.
- Validation passes after code changes.

---

## 13. Known Implementation Notes

- Use public fonts such as Inter, Manrope, or Nunito Sans.
- If product images are unavailable, use intentional branded visual placeholders with gradients, icons, labels, or category visuals — not empty gray blocks.
- For real payment, authentication, or external services, require proper configuration and credentials before implementation.
- If shadcn/ui components do not exist yet, create or adapt local components carefully without changing package policy unexpectedly.
- For visual updates, prefer improving existing sections over creating disconnected new sections.