import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { WebsiteSpec } from "../../project/project-state.schema";
import type { OpenAIProvider } from "../../openai/openai-provider.server";

export type DesignGenerationInput = {
  websiteSpec: WebsiteSpec;
  userPrompt: string;
  provider?: OpenAIProvider;
  model?: string;
  signal?: AbortSignal;
};

export type DesignGenerationResult = {
  visualMarkdown: string;
  source: "ai" | "fallback";
};

const REQUIRED_SECTION_HEADINGS: ReadonlyArray<{ index: number; heading: string }> = [
  { index: 1, heading: "Visual Theme & Atmosphere" },
  { index: 2, heading: "Color Palette & Roles" },
  { index: 3, heading: "Typography Rules" },
  { index: 4, heading: "Spacing System" },
  { index: 5, heading: "Radius, Shadow & Motion" },
  { index: 6, heading: "Component Styling" },
  { index: 7, heading: "Layout Principles" },
  { index: 8, heading: "Responsive Behavior" },
];

const FEW_SHOT_TEMPLATE_PATH = "templates/storefront/basic-ecommerce/DESIGN.md";
const FEW_SHOT_MAX_CHARS = 3500;

let cachedFewShot: string | null = null;

export async function generateVisualDesignMarkdown(
  input: DesignGenerationInput,
): Promise<DesignGenerationResult> {
  if (!input.provider || !input.model) {
    return {
      visualMarkdown: buildHeuristicVisualMarkdown(input.websiteSpec),
      source: "fallback",
    };
  }

  const fewShot = await loadFewShotExample();
  const systemPrompt = buildSystemPrompt(fewShot);
  const userMessage = buildUserMessage(input.websiteSpec, input.userPrompt);

  try {
    const firstAttempt = await streamMarkdown({
      provider: input.provider,
      model: input.model,
      system: systemPrompt,
      input: userMessage,
      signal: input.signal,
    });
    const firstValidation = validateVisualMarkdown(firstAttempt);
    if (firstValidation.ok) {
      return { visualMarkdown: firstAttempt, source: "ai" };
    }

    console.info(
      JSON.stringify({
        event: "design_generation_shape_retry",
        missingSections: firstValidation.missingSections,
      }),
    );

    const retryMessage =
      typeof userMessage === "string"
        ? `${userMessage}\n\nYour previous output was missing sections: ${firstValidation.missingSections.join(", ")}. Regenerate the FULL sections 1-8 with the required headings.`
        : {
            ...(userMessage as Record<string, unknown>),
            previousFailure: `Missing sections: ${firstValidation.missingSections.join(", ")}. Regenerate full sections 1-8.`,
          };

    const retryAttempt = await streamMarkdown({
      provider: input.provider,
      model: input.model,
      system: systemPrompt,
      input: retryMessage,
      signal: input.signal,
    });
    const retryValidation = validateVisualMarkdown(retryAttempt);
    if (retryValidation.ok) {
      return { visualMarkdown: retryAttempt, source: "ai" };
    }

    console.warn(
      JSON.stringify({
        event: "design_generation_failed_after_retry_using_fallback",
        missingSections: retryValidation.missingSections,
      }),
    );
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "design_generation_failed_using_fallback",
        error: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400),
      }),
    );
  }

  return {
    visualMarkdown: buildHeuristicVisualMarkdown(input.websiteSpec),
    source: "fallback",
  };
}

async function streamMarkdown(args: {
  provider: OpenAIProvider;
  model: string;
  system: string;
  input: unknown;
  signal?: AbortSignal;
}): Promise<string> {
  let accumulated = "";
  for await (const event of args.provider.streamText({
    model: args.model,
    system: args.system,
    input: args.input,
    signal: args.signal,
  })) {
    if (event.type === "delta" && event.text) {
      accumulated += event.text;
    }
  }
  return accumulated.trim();
}

function buildSystemPrompt(fewShot: string): string {
  return `You are the Design System Author for an AI E-commerce Website Builder.

Your task: produce sections 1 through 8 of a project's DESIGN.md file. The DESIGN.md will be the single source of truth for the visual identity of one specific retail storefront project.

OUTPUT CONTRACT:
- Output ONLY raw markdown. Do not wrap in code fences. Do not add preface or trailing commentary.
- Output MUST contain exactly 8 sections, in order, with these headings:
  ## 1. Visual Theme & Atmosphere
  ## 2. Color Palette & Roles
  ## 3. Typography Rules
  ## 4. Spacing System
  ## 5. Radius, Shadow & Motion
  ## 6. Component Styling
  ## 7. Layout Principles
  ## 8. Responsive Behavior
- DO NOT write sections 9, 10, 11, 12, or 13. They are appended automatically afterwards.
- DO NOT write stack rules, agent rules, quality checklists, or implementation notes.

CONTENT RULES:
- Tailor the entire visual identity to the project described in the user message: store type, products, brand tone, target customers.
- Pick a coherent vibe (e.g. minimalist, luxury dark, playful pastel, streetwear, organic, tech, premium, friendly) that fits the products. Do not default to the example's vibe.
- Section 2 must define every color role used elsewhere as concrete hex/rgba values: primary brand, accent (for CTAs), surfaces (page canvas, card, dark surface), text on light, text on dark, semantic colors. Honor any colors the user specified.
- Section 3 must declare a public-font font-family stack and a typography hierarchy table (display, hero, h1, h2, h3, body, small, micro) with sizes, weights, line heights.
- Section 6 must specify components for retail commerce: buttons (primary, outline, dark-surface variants), product card, header/nav, hero section, product grid, feature band, forms, optional floating cart CTA.
- Section 8 must specify breakpoints and responsive behavior for retail layouts.
- Use lists, tables, and short prose. Aim for 350-650 lines total across sections 1-8.

EXAMPLE STRUCTURE (a different project — generate a DIFFERENT visual identity, do not copy these tokens):

<example>
${fewShot}
</example>

Output the markdown now, starting with "## 1. Visual Theme & Atmosphere".`;
}

function buildUserMessage(spec: WebsiteSpec, userPrompt: string) {
  return {
    userPrompt,
    store: {
      name: spec.store.name,
      type: spec.store.type,
      description: spec.store.description,
      targetCustomers: spec.store.targetCustomers,
    },
    brand: {
      name: spec.brand.name,
      tone: spec.brand.tone,
      tagline: spec.brand.tagline,
      colors: spec.brand.colors,
      typography: spec.brand.typography,
      visualStyle: spec.brand.visualStyle,
    },
    products: spec.products.slice(0, 3).map((p) => ({
      name: p.name,
      category: p.category,
      price: p.price,
      description: p.description,
    })),
    pages: spec.pages.map((p) => p.name),
    contentHints: {
      heroTitle: spec.content.heroTitle,
      heroSubtitle: spec.content.heroSubtitle,
      primaryCta: spec.content.primaryCta,
      trustSignals: spec.content.trustSignals,
    },
  };
}

export function validateVisualMarkdown(markdown: string): {
  ok: boolean;
  missingSections: string[];
} {
  const missing = REQUIRED_SECTION_HEADINGS.filter(({ index, heading }) => {
    const headingPattern = new RegExp(
      `##\\s+${index}\\.\\s+${escapeRegex(heading)}`,
      "i",
    );
    return !headingPattern.test(markdown);
  });
  return {
    ok: missing.length === 0,
    missingSections: missing.map(({ index, heading }) => `${index}. ${heading}`),
  };
}

async function loadFewShotExample(): Promise<string> {
  if (cachedFewShot !== null) return cachedFewShot;
  try {
    const fullPath = resolve(process.cwd(), FEW_SHOT_TEMPLATE_PATH);
    const raw = await readFile(fullPath, "utf-8");
    const splitIndex = raw.indexOf("\n## 9.");
    const sectionsOneToEight = splitIndex > 0 ? raw.slice(0, splitIndex) : raw;
    const trimmed =
      sectionsOneToEight.length > FEW_SHOT_MAX_CHARS
        ? `${sectionsOneToEight.slice(0, FEW_SHOT_MAX_CHARS)}\n\n... (truncated)`
        : sectionsOneToEight;
    cachedFewShot = trimmed;
    return trimmed;
  } catch {
    cachedFewShot = "";
    return "";
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildHeuristicVisualMarkdown(spec: WebsiteSpec): string {
  const palette = derivePalette(spec);
  const fontStack = deriveFontStack(spec);
  const vibe = describeVibe(spec);

  return `## 1. Visual Theme & Atmosphere

This design system is for a ${vibe.atmosphere} retail storefront for ${spec.store.name}. The storefront should feel ${vibe.feels.join(", ")}.

The visual language is built around:

- ${palette.canvas} page canvas
- ${palette.cardSurface} card surfaces
- ${palette.accent} primary CTA color
- generous spacing
- clear product hierarchy
- responsive retail layouts
- soft shadows
- rounded geometry
- complete commerce sections

### Page Rhythm

A complete storefront should follow this rhythm:

\`\`\`text
Header / Navigation
→ Hero section
→ Featured product grid
→ Trust or benefit signals
→ Feature or campaign band
→ Newsletter / final CTA
→ Footer
\`\`\`

---

## 2. Color Palette & Roles

### Primary Brand Colors

- **Primary Brand** (\`${palette.primary}\`): brand anchor for headings, highlights, and selected states.
- **Accent Brand** (\`${palette.accent}\`): main CTA color for buttons, active states, and cart actions.
- **Deep Brand** (\`${palette.deep}\`): dark feature-band and footer surface for high-impact sections.

### Surface Colors

- **Page Canvas** (\`${palette.canvas}\`): default global background.
- **Card Surface** (\`${palette.cardSurface}\`): primary card and modal surface.
- **Section Surface** (\`${palette.section}\`): section background and soft utility zones.
- **Dark Surface** (\`${palette.deep}\`): footer, feature band, dark campaign surface.

### Text Colors

- **Text Primary** (\`${palette.textPrimary}\`): main text on light backgrounds.
- **Text Secondary** (\`${palette.textSecondary}\`): metadata and muted copy.
- **Text On Dark** (\`#FFFFFF\`): main text on dark backgrounds.
- **Text On Dark Secondary** (\`rgba(255, 255, 255, 0.70)\`): secondary copy on dark sections.

### Semantic Colors

- **Error** (\`#C82014\`): error and destructive states.
- **Warning** (\`#FBBC05\`): warning or attention states.
- **Success** (\`#1F8A4C\`): valid form state or success indicators.

### Color Rules

- Use the page canvas for the overall storefront.
- Use the accent brand color for main CTAs.
- Use dark brand surfaces for feature bands and footer.
- Keep product cards on the card surface color.
- Use high contrast for purchase actions.

---

## 3. Typography Rules

### Font Family

\`\`\`css
font-family: ${fontStack};
\`\`\`

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

- Default: \`-0.01em\`
- Uppercase labels: \`0.12em\` to \`0.15em\`

### Typography Principles

- Use weight and color to create hierarchy.
- Avoid excessive font-size jumps.
- Keep body copy readable and benefit-led.

---

## 4. Spacing System

| Token | Value | Typical Use |
|---|---:|---|
| \`space-1\` | 4px | Tight inline spacing |
| \`space-2\` | 8px | Small gaps |
| \`space-3\` | 16px | Default card padding and mobile gutter |
| \`space-4\` | 24px | Section inner spacing |
| \`space-5\` | 32px | Major card/section gap |
| \`space-6\` | 40px | Desktop gutter and large gaps |
| \`space-7\` | 48px | Section-to-section spacing |
| \`space-8\` | 56px | Large component height |
| \`space-9\` | 64px | Large section padding |

### Gutters

- Mobile: \`16px\`
- Tablet: \`24px\`
- Desktop: \`40px\`

### Spacing Rules

- Use generous section padding: \`40px\` to \`64px\` on desktop.
- Product cards need enough internal padding for image, title, price, badge, and CTA.
- Do not let content touch viewport edges.
- Separate major sections with whitespace rather than heavy dividers.

---

## 5. Radius, Shadow & Motion

### Radius

| Value | Use |
|---:|---|
| \`8px\` | Inputs and small controls |
| \`12px\` | Cards, modals, product tiles |
| \`50px\` | Buttons and pill badges |
| \`50%\` | Circular icons and floating actions |

### Shadows

\`\`\`css
--shadow-card: 0 0 0.5px rgba(0,0,0,0.14), 0 1px 1px rgba(0,0,0,0.24);
--shadow-nav: 0 1px 3px rgba(0,0,0,0.10), 0 2px 2px rgba(0,0,0,0.06);
--shadow-floating: 0 0 6px rgba(0,0,0,0.24), 0 8px 12px rgba(0,0,0,0.14);
\`\`\`

### Motion

- Button active: \`transform: scale(0.95)\`
- Button transition: \`all 0.2s ease\`
- Image fade-in: \`opacity 0.3s ease-in\`

---

## 6. Component Styling

### Buttons

#### Primary Filled

- Background: Accent Brand (\`${palette.accent}\`)
- Text: White
- Radius: \`50px\`
- Padding: \`0.7rem 1.6rem\`
- Font weight: \`600\`
- Active: \`scale(0.95)\`

#### Primary Outlined

- Background: transparent
- Text: Accent Brand
- Border: \`1px solid ${palette.accent}\`
- Radius: \`50px\`

#### Dark Surface Primary

- Background: White
- Text: Accent Brand or Deep Brand
- Radius: \`50px\`

### Product Card

A product card must include:

- product visual
- product name
- price
- category, badge, or sale state when available
- CTA: Add to cart, Quick add, or View details
- optional wishlist action

Rules:

- Product image area should look intentional.
- Use consistent aspect ratio.
- Place CTA where users can quickly act.
- Keep price visible and easy to scan.

### Header / Navigation

- brand name or logo text
- navigation links
- cart affordance
- responsive mobile menu behavior
- subtle border or shadow separating it from content

### Hero Section

- strong headline
- short supporting copy
- primary CTA
- optional secondary CTA
- visual area or product/category highlight

### Product Grid

- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 to 4 columns
- Large desktop: up to 5 if cards remain readable

### Feature Band

- Background: Deep Brand (\`${palette.deep}\`)
- Primary text: White
- Secondary text: White at 70% opacity
- CTA: white-filled pill or white-outlined pill

### Forms

- Use React Hook Form with Zod for generated forms.
- Show accessible validation errors.
- Use \`8px\` input radius.
- Keep form layout simple and mobile-friendly.

### Floating Commerce CTA (optional)

- Size: \`56px\`
- Shape: circle
- Background: Accent Brand
- Icon: White
- Position: bottom-right

---

## 7. Layout Principles

### Storefront Completeness

A basic retail storefront should include:

1. Header / navigation
2. Hero section
3. Product / category section
4. Product grid
5. Benefit or trust section
6. Promotion or feature band
7. Newsletter or final CTA
8. Footer

### Whitespace Philosophy

- generous section spacing
- consistent card gaps
- readable max-widths
- visual grouping through surfaces

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
| XS | \`<480px\` | Single column, mobile nav, full-width buttons |
| Mobile | \`480–767px\` | 1–2 column grids where appropriate |
| Tablet | \`768–1023px\` | 2–3 column grids, hero split may begin |
| Desktop | \`1024–1439px\` | Full hero split, 3–4 product columns |
| XL | \`1440px+\` | Larger max-width and optional 5-column grids |

### Responsive Rules

- Hero split collapses into stacked layout on mobile.
- Product grid collapses to one column on small screens.
- Touch targets should be at least \`44px\` tall on mobile.
- Outer gutter scales from \`16px\` to \`24px\` to \`40px\`.
- Do not create horizontal overflow.
- CTA buttons should remain easy to tap.
`;
}

type DerivedPalette = {
  primary: string;
  accent: string;
  deep: string;
  canvas: string;
  cardSurface: string;
  section: string;
  textPrimary: string;
  textSecondary: string;
};

function derivePalette(spec: WebsiteSpec): DerivedPalette {
  const colors = spec.brand.colors;
  const tone = spec.brand.tone;
  const isDark = tone === "luxury" || tone === "tech" || tone === "bold";
  const defaults = isDark
    ? {
        primary: "#0F172A",
        accent: "#D4AF37",
        deep: "#0B0F19",
        canvas: "#0F172A",
        cardSurface: "#111827",
        section: "#1E293B",
        textPrimary: "rgba(255,255,255,0.92)",
        textSecondary: "rgba(255,255,255,0.62)",
      }
    : tone === "playful"
      ? {
          primary: "#FF5A5F",
          accent: "#FF8C42",
          deep: "#1F2937",
          canvas: "#FFF7ED",
          cardSurface: "#FFFFFF",
          section: "#FFE7D1",
          textPrimary: "rgba(0,0,0,0.87)",
          textSecondary: "rgba(0,0,0,0.58)",
        }
      : tone === "organic"
        ? {
            primary: "#2F5D3A",
            accent: "#5B8C5A",
            deep: "#1F3A2A",
            canvas: "#F4F1EA",
            cardSurface: "#FFFFFF",
            section: "#E9E3D4",
            textPrimary: "rgba(0,0,0,0.87)",
            textSecondary: "rgba(0,0,0,0.58)",
          }
        : tone === "minimal"
          ? {
              primary: "#111827",
              accent: "#111827",
              deep: "#0B0F19",
              canvas: "#FFFFFF",
              cardSurface: "#FFFFFF",
              section: "#F5F5F5",
              textPrimary: "rgba(0,0,0,0.87)",
              textSecondary: "rgba(0,0,0,0.58)",
            }
          : {
              primary: "#006241",
              accent: "#00754A",
              deep: "#1E3932",
              canvas: "#F2F0EB",
              cardSurface: "#FFFFFF",
              section: "#EDEBE9",
              textPrimary: "rgba(0,0,0,0.87)",
              textSecondary: "rgba(0,0,0,0.58)",
            };

  return {
    primary: colors.primary || defaults.primary,
    accent: colors.accent || defaults.accent,
    deep: defaults.deep,
    canvas: colors.background || defaults.canvas,
    cardSurface: defaults.cardSurface,
    section: defaults.section,
    textPrimary: colors.foreground || defaults.textPrimary,
    textSecondary: defaults.textSecondary,
  };
}

function deriveFontStack(spec: WebsiteSpec): string {
  const headingFont = spec.brand.typography?.heading;
  const bodyFont = spec.brand.typography?.body;
  if (headingFont || bodyFont) {
    const primary = bodyFont || headingFont;
    return `${primary}, Inter, Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  }
  if (spec.brand.tone === "luxury" || spec.brand.tone === "premium") {
    return `Cormorant Garamond, Playfair Display, Inter, system-ui, sans-serif`;
  }
  if (spec.brand.tone === "tech") {
    return `Inter, "JetBrains Mono", system-ui, sans-serif`;
  }
  if (spec.brand.tone === "playful") {
    return `Nunito, Manrope, system-ui, sans-serif`;
  }
  return `Inter, Manrope, "Nunito Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

function describeVibe(spec: WebsiteSpec): { atmosphere: string; feels: string[] } {
  const tone = spec.brand.tone;
  const map: Record<typeof tone, { atmosphere: string; feels: string[] }> = {
    minimal: {
      atmosphere: "minimal and editorial",
      feels: ["calm", "considered", "premium without being loud"],
    },
    premium: {
      atmosphere: "premium and refined",
      feels: ["polished", "trustworthy", "high-touch"],
    },
    luxury: {
      atmosphere: "luxurious and dark",
      feels: ["confident", "elevated", "exclusive"],
    },
    friendly: {
      atmosphere: "warm and approachable",
      feels: ["inviting", "trustworthy", "ready for shopping"],
    },
    playful: {
      atmosphere: "playful and energetic",
      feels: ["fun", "vibrant", "youthful"],
    },
    bold: {
      atmosphere: "bold and high-contrast",
      feels: ["confident", "modern", "impactful"],
    },
    streetwear: {
      atmosphere: "streetwear and urban",
      feels: ["edgy", "modern", "drop-driven"],
    },
    organic: {
      atmosphere: "natural and organic",
      feels: ["earthy", "honest", "grounded"],
    },
    tech: {
      atmosphere: "technical and precise",
      feels: ["clean", "engineered", "spec-forward"],
    },
  };
  return map[tone] ?? map.friendly;
}
