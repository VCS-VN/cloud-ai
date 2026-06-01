import type { WebsiteSpec } from "../../project/project-state.schema";
import type { OpenAIProvider } from "../../openai/openai-provider.server";
import type { TokenHint } from "../../planning/design-intent-heuristic";
import { buildStructuralOutline } from "./design-skill-outline.server";import { parseDesignTokenBlock } from "./design-file-validator.server";
import { readTokenValue, type DesignTokenProvenance } from "./design-token-schema.server";

export type UserProvenanceToken = {
  role: string;
  value: string;
  provenance: "user";
};

/**
 * Extracts user-provenance tokens from an existing DESIGN.md content.
 * These tokens must be preserved during redesign unless the current prompt conflicts.
 */
export function extractUserProvenanceTokens(designMarkdown: string): UserProvenanceToken[] {
  const block = parseDesignTokenBlock(designMarkdown);
  if (!block?.tokens?.colors) return [];

  const userTokens: UserProvenanceToken[] = [];
  const colors = block.tokens.colors;
  for (const [role, entry] of Object.entries(colors)) {
    if (typeof entry === "object" && entry && "provenance" in entry) {
      const provenance = (entry as Record<string, unknown>).provenance;
      if (provenance === "user") {
        const value = readTokenValue(entry);
        if (value) {
          userTokens.push({ role, value, provenance: "user" });
        }
      }
    }
  }
  return userTokens;
}

/**
 * Returns true if the current prompt explicitly conflicts with a user-provenance token.
 * A conflict means the prompt asks to change the same token role.
 */
export function doesPromptConflictWithUserToken(
  prompt: string,
  userToken: UserProvenanceToken,
): boolean {
  const lower = prompt.toLowerCase();
  // Check if prompt mentions the token role
  return lower.includes(userToken.role.toLowerCase());
}


import {
  buildSensitiveTokenSet,
  validateAntiTemplateLeak,
  type AntiTemplateLeakVerdict,
} from "./design-template-leak-validator.server";

export type DesignGenerationInput = {
  websiteSpec: WebsiteSpec;
  userPrompt: string;
  provider?: OpenAIProvider;
  model?: string;
  signal?: AbortSignal;
  tokenHints?: ReadonlyArray<TokenHint>;
  skipLeakValidation?: boolean;
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

// Structural outline replaces few-shot template content.
// Anti-template-leak validation runs post-generation in init / redesign paths.

export async function generateVisualDesignMarkdown(
  input: DesignGenerationInput,
): Promise<DesignGenerationResult> {
  if (!input.provider || !input.model) {
    return {
      visualMarkdown: buildHeuristicVisualMarkdown(input.websiteSpec),
      source: "fallback",
    };
  }

  const outline = buildStructuralOutline();
  const tokenHints = input.tokenHints ?? [];
  const honoredValues = buildHonoredValueSet(tokenHints);
  const systemPrompt = buildSystemPrompt(outline.body, tokenHints);
  const userMessage = buildUserMessage(input.websiteSpec, input.userPrompt);
  const sensitiveSet = input.skipLeakValidation
    ? null
    : await safeBuildSensitiveTokenSet();

  try {
    const firstAttempt = await streamMarkdown({
      provider: input.provider,
      model: input.model,
      system: systemPrompt,
      input: userMessage,
      signal: input.signal,
    });
    const firstStructural = validateVisualMarkdown(firstAttempt);
    const firstLeak = sensitiveSet
      ? validateAntiTemplateLeak(firstAttempt, sensitiveSet, { honoredValues })
      : ({ ok: true } as AntiTemplateLeakVerdict);
    if (firstStructural.ok && firstLeak.ok) {
      return { visualMarkdown: firstAttempt, source: "ai" };
    }

    console.info(
      JSON.stringify({
        event: "design_generation_validation_retry",
        missingSections: firstStructural.missingSections,
        leaked: firstLeak.ok ? [] : firstLeak.leaked.map((l) => `${l.kind}:${l.value}`),
      }),
    );

    const failureNote = buildFailureNote(firstStructural, firstLeak);
    const retryMessage =
      typeof userMessage === "string"
        ? `${userMessage}\n\n${failureNote}`
        : {
            ...(userMessage as Record<string, unknown>),
            previousFailure: failureNote,
          };

    const retryAttempt = await streamMarkdown({
      provider: input.provider,
      model: input.model,
      system: systemPrompt,
      input: retryMessage,
      signal: input.signal,
    });
    const retryStructural = validateVisualMarkdown(retryAttempt);
    const retryLeak = sensitiveSet
      ? validateAntiTemplateLeak(retryAttempt, sensitiveSet, { honoredValues })
      : ({ ok: true } as AntiTemplateLeakVerdict);
    if (retryStructural.ok && retryLeak.ok) {
      return { visualMarkdown: retryAttempt, source: "ai" };
    }

    console.warn(
      JSON.stringify({
        event: "design_generation_failed_after_retry_using_fallback",
        missingSections: retryStructural.missingSections,
        leaked: retryLeak.ok ? [] : retryLeak.leaked.map((l) => `${l.kind}:${l.value}`),
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

async function safeBuildSensitiveTokenSet() {
  try {
    return await buildSensitiveTokenSet();
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "design_template_sensitive_set_unavailable",
        error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
      }),
    );
    return null;
  }
}

function buildHonoredValueSet(
  hints: ReadonlyArray<TokenHint>,
): ReadonlySet<string> {
  const set = new Set<string>();
  for (const hint of hints) {
    if (!hint.value) continue;
    if (hint.value.startsWith("#")) {
      set.add(hint.value.toUpperCase());
    } else {
      set.add(hint.value.toLowerCase().trim());
    }
  }
  return set;
}

function buildFailureNote(
  structural: { ok: boolean; missingSections: string[] },
  leak: AntiTemplateLeakVerdict,
): string {
  const parts: string[] = [];
  if (!structural.ok) {
    parts.push(
      `Previous output was missing required sections: ${structural.missingSections.join(", ")}. Regenerate the FULL sections 1-8 with the exact required headings.`,
    );
  }
  if (!leak.ok) {
    const samples = leak.leaked
      .slice(0, 8)
      .map((l) => `${l.kind}:${l.value}`)
      .join(", ");
    parts.push(
      `Previous output reused values from the structural reference template (${samples}). Choose DIFFERENT concrete values that fit the chosen vibe and the project; never copy values from any reference template. User-specified values remain allowed.`,
    );
  }
  return parts.join("\n\n");
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

function buildSystemPrompt(
  outlineBody: string,
  tokenHints: ReadonlyArray<TokenHint>,
): string {
  const hintBlock =
    tokenHints.length > 0
      ? `\nUSER-SPECIFIED TOKEN VALUES (honor these for the matching role):\n${tokenHints
          .map((h) => `- ${h.role}: ${h.value}`)
          .join("\n")}\n`
      : "";

  return `You are the Storefront Design Authoring agent for an AI E-commerce Website Builder.

Your task: produce sections 1 through 8 of one project's managed DESIGN.md file. The pipeline will prepend structured designIntent and token metadata; your markdown sections must agree with that project-local visual identity and remain the single source of UI guidance for one specific retail storefront project.

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
- Section 1 MUST open with a one-line Design Read in exactly this form: "Reading this as: <retail category> storefront for <audience>, with a <vibe> retail language." Then explain the inferred retail category, target audience, price tier, chosen archetype, mood keywords, what makes this project distinct, and what visual approaches must not be used.
- Anti-default discipline: do NOT reach for the usual AI defaults — AI-purple/violet gradients, a centered hero over a dark mesh/aurora gradient, three equal feature cards, generic glassmorphism on everything, or Inter + slate-900 by reflex. Choose deliberately from the design read.
- Pick ONE coherent vibe that genuinely fits the products, audience, and user prompt. The default quality bar is retail editorial premium: visually confident, commerce-focused, polished, and category-aware. The exact expression can become luxury minimalist, bold playful, organic premium, streetwear editorial, tech premium, handcrafted editorial, or another fitting direction. Do NOT create a generic SaaS landing page and do NOT default to a warm-beige + dark-green coffee vibe unless the prompt clearly calls for it.
- Section 2 must declare every color role with a concrete hex value chosen FOR THIS PROJECT. NEVER copy concrete values from any structural reference template; choose values that match the chosen vibe and maintain readable foreground/background contrast.
- Section 3 must declare a public font-family stack with system fallbacks and a typography hierarchy table covering display / hero / h1 / h2 / h3 / body large / body / small / micro with sizes, weights, line heights.
- Section 6 must specify components for retail commerce: buttons (primary filled, primary outlined, dark-surface variants), product card, header/nav, editorial hero, featured product grid, trust/social proof strip, category/benefit band, newsletter/final CTA, forms, optional floating cart CTA.
- Section 7 must define homepage rhythm as at least: Hero → Featured Products → Trust/Social Proof → Category/Benefit Band → Newsletter/Final CTA. Allow section content and order details to adapt to the retail category, but require a strong hero with large headline, clear CTA, and prominent product/category visual.
- Section 8 must specify breakpoints and responsive behavior for retail layouts, including how the editorial hero, product/category visual, featured product grid, trust/social proof, and final CTA collapse on mobile.
- Product/category visuals should prefer real product images when available. If images are missing, specify intentional branded editorial compositions using declared DESIGN.md roles only: token-safe gradients, product/category labels, badges, stats, abstract shapes, and layered surfaces. Never specify empty gray blocks or invented external image URLs.
- Motion should be tasteful and low-distraction. Avoid excessive animation, overused glassmorphism, and effects that compete with shopping actions.
- Use lists, tables, and short prose. Aim for 350-650 lines total across sections 1-8.
${hintBlock}
STRUCTURAL OUTLINE (use as shape only; do NOT copy any concrete values; this outline carries no token values to copy):

<outline>
${outlineBody}
</outline>

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
