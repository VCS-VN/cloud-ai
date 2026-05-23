export type StructuralOutline = {
  version: string;
  body: string;
};

const OUTLINE_VERSION = "1.0.0";

const OUTLINE_BODY = [
  "## 1. Visual Theme & Atmosphere",
  "- Pick ONE vibe coherent with the store / products / brand tone (e.g. minimalist, luxury, playful, organic, streetwear, tech, premium, friendly, editorial, handcrafted, retro). Do NOT default to a 'warm beige + dark green' coffee/cosmetic vibe unless that vibe genuinely fits the prompt.",
  "- Document inferred retail category, target audience, price tier, chosen archetype, 4-6 atmospheric adjectives, what makes this project distinct, and what visual approaches must not be used.",
  "- State the page rhythm the storefront will follow.",
  "",
  "## 2. Color Palette & Roles",
  "Declare every role below with a project-specific concrete hex value. NEVER copy concrete values from any structural reference template; choose values that fit the chosen vibe, any user-supplied hints, and readable foreground/background contrast.",
  "Required roles (bullet rows in the form `- **<Role Name>** (\\`<value>\\`): <one-sentence usage>`):",
  "- primary brand",
  "- accent brand (CTA color)",
  "- deep surface (feature band / footer dark surface)",
  "- page canvas (global page background)",
  "- card surface",
  "- section surface",
  "- text on light",
  "- text on light muted",
  "- text on dark",
  "- text on dark muted",
  "- error / destructive",
  "- warning",
  "- success",
  "Optional roles when the vibe needs them: premium accent, premium surface, sale tint, gradient stops.",
  "",
  "## 3. Typography Rules",
  "- Declare ONE primary font-family stack with public webfont(s) + system fallback. The chosen family must match the vibe (e.g. geometric sans for tech, humanist sans for friendly, transitional serif for editorial / luxury).",
  "- Provide a hierarchy table with rows for: display, hero, h1, h2, h3, body large, body, small, micro. Each row declares size, weight, line-height. Use a clear hierarchy; never collapse two rows.",
  "",
  "## 4. Spacing System",
  "- Declare a monotonic scale named `space-1` through `space-9` (or equivalent) with project-chosen values.",
  "- Declare mobile / tablet / desktop gutters explicitly.",
  "",
  "## 5. Radius, Shadow & Motion",
  "- Radius table with roles: input, card, pill, optional circle.",
  "- Shadow declarations using `--shadow-card`, `--shadow-nav`, `--shadow-floating`. Each one concrete declaration appropriate for the chosen vibe (sharp / soft / heavy / floating).",
  "- Motion: press feedback transform, default transition, optional accordion easing.",
  "",
  "## 6. Component Styling",
  "- Buttons: primary filled, primary outlined, dark-surface filled, dark-surface outlined. Each variant references roles from sections 2 / 5.",
  "- Product card: visual area, name, price, badge / sale, CTA, optional wishlist, optional rating.",
  "- Header / nav: brand, navigation, cart affordance, optional search / account.",
  "- Hero section: headline, subcopy, primary CTA, optional secondary CTA, visual area.",
  "- Product grid: column counts per breakpoint.",
  "- Feature band: dark promotional band rules.",
  "- Forms: input radius, validation tints, submit shape.",
  "- Optional floating cart CTA.",
  "",
  "## 7. Layout Principles",
  "- Container max-width and gutters per breakpoint.",
  "- Section padding scale and whitespace philosophy.",
  "- Default page rhythm: header -> hero -> category/benefit strip -> featured product grid -> trust/benefit -> feature band -> newsletter / final CTA -> footer.",
  "",
  "## 8. Responsive Behavior",
  "- Named breakpoints (>=5 named tiers, e.g. XS / Mobile / Tablet / Desktop / XL).",
  "- Hero, product grid, feature band, gutter behavior per tier.",
  "- Touch target minimums.",
].join("\n");

export function buildStructuralOutline(): StructuralOutline {
  return { version: OUTLINE_VERSION, body: OUTLINE_BODY };
}
