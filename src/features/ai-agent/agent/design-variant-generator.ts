/**
 * DesignVariantGenerator — generates 3 design variants from taste skill aesthetic families.
 *
 * Flow:
 *  1. Given brief context + taste skill design read → select 3 distinct aesthetic families
 *  2. Each family gets a hard-constraint prompt: "You MUST use [family] aesthetic"
 *  3. 3 prompts run in parallel → 3 DesignVariant results
 *  4. Optional pages parsed from user prompt, suggest more via agent_question
 */

import type { DesignVariant } from "@/shared/project-types";

// --- Mandatory pages for retail projects ---

export const MANDATORY_RETAIL_PAGES = [
  "home",
  "products",
  "cart",
  "checkout",
  "orders",
  "order_detail",
] as const;

export type MandatoryPage = (typeof MANDATORY_RETAIL_PAGES)[number];

// --- Aesthetic Family ---

export type AestheticFamily = {
  id: string;
  label: string;
  description: string;
  font: string;
  palette: string[];
  motion: number;
  density?: number;
};

// --- Brief Context (from taste skill Section 0) ---

export type DesignBriefContext = {
  pageKind: string;
  audience: string;
  vibe: string;
  referenceSignals?: string[];
  constraints?: string[];
};

// --- Aesthetic family pool ---
// Families mapped from taste skill Section 1.A (Dial Inference) + Section 1.B (Presets)

const AESTHETIC_FAMILIES: AestheticFamily[] = [
  {
    id: "minimalist-editorial",
    label: "Minimalist Editorial",
    description: "Layout thoáng, typography lớn, màu trung tính. Tập trung vào nội dung, không gian trắng rộng rãi.",
    font: "Geist",
    palette: ["#fafafa", "#1a1a1a", "#6b7280", "#10b981"],
    motion: 3,
    density: 2,
  },
  {
    id: "premium-consumer",
    label: "Premium Consumer",
    description: "Sang trọng, tinh tế. Màu ấm, typography serif, animation mượt mà.",
    font: "Playfair Display",
    palette: ["#fefefe", "#1a1a2e", "#c9a96e", "#16213e"],
    motion: 5,
    density: 3,
  },
  {
    id: "dark-tech",
    label: "Dark Tech",
    description: "Tối, hiện đại, công nghệ. Màu tối chủ đạo, accent neon, typography mono cho headings.",
    font: "JetBrains Mono",
    palette: ["#0a0a0a", "#e2e8f0", "#38bdf8", "#7c3aed"],
    motion: 7,
    density: 4,
  },
  {
    id: "playful-brand",
    label: "Playful Brand",
    description: "Vui tươi, năng động, màu sắc tươi sáng. Typography rounded, animation vui nhộn.",
    font: "Outfit",
    palette: ["#fffbeb", "#1e293b", "#f59e0b", "#ec4899"],
    motion: 8,
    density: 3,
  },
  {
    id: "linear-clean",
    label: "Linear Clean",
    description: "Sạch sẽ, chuyên nghiệp, tối giản công nghệ. Layout grid rõ ràng, icon tinh tế.",
    font: "Inter",
    palette: ["#ffffff", "#0f172a", "#64748b", "#2563eb"],
    motion: 4,
    density: 3,
  },
  {
    id: "warm-boutique",
    label: "Warm Boutique",
    description: "Ấm áp, thân thiện, thủ công. Màu đất, typography mềm mại, hình ảnh organic.",
    font: "Lora",
    palette: ["#faf7f2", "#3d2c2e", "#a67c52", "#d4a574"],
    motion: 3,
    density: 2,
  },
  {
    id: "editorial-luxury",
    label: "Editorial Luxury",
    description: "Tạp chí cao cấp, layout bất đối xứng. Typography bold, ảnh full-bleed, whitespace rộng.",
    font: "Cormorant Garamond",
    palette: ["#f5f0eb", "#1c1c1c", "#8b7355", "#c4a882"],
    motion: 4,
    density: 2,
  },
  {
    id: "brutalist-raw",
    label: "Brutalist Raw",
    description: "Thô mộc, cá tính, phá cách. Màu đen trắng đậm, border dày, typography khối.",
    font: "Space Grotesk",
    palette: ["#ffffff", "#000000", "#ff3d00", "#ffeb3b"],
    motion: 9,
    density: 5,
  },
];

// --- Mapping brief → families ---

/** Vibe-to-family heuristics from taste skill Section 1.A Dial Inference */
function vibeMatchScore(family: AestheticFamily, brief: DesignBriefContext, seed: number): number {
  let score = 0;
  const vibe = brief.vibe.toLowerCase();
  const audience = brief.audience.toLowerCase();

  // Premium / luxury signals
  if (
    vibe.includes("premium") ||
    vibe.includes("luxury") ||
    vibe.includes("apple") ||
    audience.includes("high-end") ||
    audience.includes("luxury")
  ) {
    if (family.id === "premium-consumer") score += 5;
    if (family.id === "editorial-luxury") score += 4;
    if (family.id === "warm-boutique") score += 2;
  }

  // Minimalist / clean / Linear-style
  if (
    vibe.includes("minimal") ||
    vibe.includes("clean") ||
    vibe.includes("linear") ||
    vibe.includes("calm")
  ) {
    if (family.id === "minimalist-editorial") score += 5;
    if (family.id === "linear-clean") score += 4;
  }

  // Playful / bold / wild / experimental
  if (
    vibe.includes("playful") ||
    vibe.includes("bold") ||
    vibe.includes("wild") ||
    vibe.includes("dribbble") ||
    vibe.includes("awwwards") ||
    vibe.includes("agency")
  ) {
    if (family.id === "playful-brand") score += 5;
    if (family.id === "brutalist-raw") score += 4;
    if (family.id === "dark-tech") score += 2;
  }

  // Dark / tech / modern
  if (vibe.includes("dark") || vibe.includes("tech") || vibe.includes("modern")) {
    if (family.id === "dark-tech") score += 5;
    if (family.id === "linear-clean") score += 3;
  }

  // Warm / friendly / boutique
  if (vibe.includes("warm") || vibe.includes("friendly") || vibe.includes("cozy")) {
    if (family.id === "warm-boutique") score += 5;
    if (family.id === "playful-brand") score += 2;
  }

  // Editorial / magazine
  if (vibe.includes("editorial") || vibe.includes("magazine")) {
    if (family.id === "editorial-luxury") score += 5;
    if (family.id === "minimalist-editorial") score += 3;
  }

  // Brutalist
  if (vibe.includes("brutal") || vibe.includes("raw")) {
    if (family.id === "brutalist-raw") score += 5;
  }

  // Base diversity bonus: deterministic using seed instead of Math.random()
  score += ((seed * 7 + family.id.charCodeAt(0)) % 100) / 100;

  return score;
}

/** Deterministic-ish selection using a simple hash of the brief. */
function briefHash(brief: DesignBriefContext): number {
  const str = `${brief.pageKind}|${brief.audience}|${brief.vibe}|${brief.referenceSignals?.join(",") ?? ""}|${brief.constraints?.join(",") ?? ""}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0; // 32-bit int
  }
  return Math.abs(hash);
}

/**
 * Select 3 distinct aesthetic families from the pool based on brief context.
 * Uses a deterministic hash + vibe matching to pick families that fit the brief.
 */
export function selectAestheticFamilies(brief: DesignBriefContext): AestheticFamily[] {
  const hash = briefHash(brief);
  const scored = AESTHETIC_FAMILIES.map((family) => ({
    family,
    score: vibeMatchScore(family, brief, hash),
  }));

  // Sort by score descending, pick top 3
  scored.sort((a, b) => b.score - a.score);

  // Ensure diversity: if top 3 are too similar (same vibe cluster), inject variety
  const selected = scored.slice(0, 3).map((s) => s.family);

  // If we somehow got < 3 (shouldn't happen with 8 families), fill with fallback
  while (selected.length < 3) {
    const remaining = AESTHETIC_FAMILIES.filter((f) => !selected.some((s) => s.id === f.id));
    if (remaining.length === 0) break;
    // deterministic pick using hash
    const idx = (hash + selected.length * 17) % remaining.length;
    selected.push(remaining[idx]);
  }

  return selected;
}

/**
 * Convert an AestheticFamily to a DesignVariant for agent_question metadata.
 */
export function designReadToVariant(family: AestheticFamily): DesignVariant {
  return {
    id: family.id,
    label: family.label,
    description: family.description,
    preview: {
      font: family.font,
      palette: family.palette,
      motion: family.motion,
      density: family.density,
    },
  };
}

/**
 * Build a hard-constraint prompt for a specific aesthetic family.
 * "You MUST use [family] aesthetic" per Decision 14 (A+C).
 */
export function buildVariantPrompt(
  userPrompt: string,
  family: AestheticFamily,
): string {
  return [
    `You MUST use ${family.label} aesthetic.`,
    "",
    `Design direction: ${family.description}`,
    `Typography: ${family.font}`,
    `Color palette: ${family.palette.join(", ")}`,
    `Motion intensity: ${family.motion}/10`,
    family.density != null ? `Visual density: ${family.density}/10` : "",
    "",
    "User request:",
    userPrompt,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * Generate all 3 variants from a brief + user prompt.
 * This is the orchestrator-facing entry point. Each variant gets its own
 * Design Read prompt; the orchestrator runs the 3 LLM calls in parallel.
 */
export function generateDesignVariants(
  brief: DesignBriefContext,
  userPrompt: string,
): {
  families: AestheticFamily[];
  variants: DesignVariant[];
  prompts: Array<{ familyId: string; prompt: string }>;
} {
  const families = selectAestheticFamilies(brief);
  const variants = families.map(designReadToVariant);
  const prompts = families.map((family) => ({
    familyId: family.id,
    prompt: buildVariantPrompt(userPrompt, family),
  }));
  return { families, variants, prompts };
}

// --- Optional page detection (US2) ---

const OPTIONAL_PAGE_KEYWORDS: Record<string, string[]> = {
  blog: ["blog", "tin tức", "bài viết", "news"],
  about: ["about", "về chúng tôi", "giới thiệu", "about us", "our story"],
  faq: ["faq", "câu hỏi", "hỏi đáp", "q&a", "help"],
  contact: ["contact", "liên hệ", "liên lạc", "get in touch"],
  gallery: ["gallery", "thư viện ảnh", "bộ sưu tập", "portfolio"],
  testimonials: ["testimonial", "đánh giá", "nhận xét", "review", "khách hàng nói"],
  pricing: ["pricing", "bảng giá", "giá cả", "price"],
  team: ["team", "đội ngũ", "nhân sự", "our team"],
  careers: ["career", "tuyển dụng", "việc làm", "join us"],
  privacy: ["privacy", "chính sách", "điều khoản", "terms", "bảo mật"],
  shipping: ["shipping", "vận chuyển", "giao hàng", "delivery"],
  returns: ["return", "đổi trả", "hoàn tiền", "refund"],
  size_guide: ["size guide", "bảng size", "hướng dẫn chọn size"],
  stores: ["store locator", "chi nhánh", "địa điểm", "tìm cửa hàng"],
  loyalty: ["loyalty", "thành viên", "tích điểm", "membership"],
};

/**
 * Extract optional page hints from user prompt.
 * Returns deduplicated list of page slugs NOT in mandatory retail pages.
 */
export function extractOptionalPagesFromPrompt(prompt: string): string[] {
  if (!prompt.trim()) return [];
  const lower = prompt.toLowerCase();

  const found = new Set<string>();
  for (const [slug, keywords] of Object.entries(OPTIONAL_PAGE_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        found.add(slug);
        break;
      }
    }
  }

  // Filter out mandatory pages
  const mandatorySet = new Set<string>(MANDATORY_RETAIL_PAGES);
  return [...found].filter((slug) => !mandatorySet.has(slug));
}

/**
 * Suggest optional pages that the agent thinks the user might want,
 * based on what the prompt mentions and what's commonly paired.
 */
export function suggestOptionalPages(
  existingPages: string[],
  userPrompt: string,
): DesignVariant[] {
  const fromPrompt = extractOptionalPagesFromPrompt(userPrompt);
  const allSeen = new Set([...existingPages, ...fromPrompt]);

  // Common companion pages for retail stores
  const suggestions: DesignVariant[] = [];
  const candidates = [
    {
      id: "about",
      label: "About Us",
      description: "Trang giới thiệu thương hiệu, câu chuyện và giá trị.",
    },
    {
      id: "blog",
      label: "Blog",
      description: "Trang tin tức, bài viết chia sẻ kiến thức và cập nhật sản phẩm.",
    },
    {
      id: "faq",
      label: "FAQ",
      description: "Trang câu hỏi thường gặp, giúp khách hàng tự tìm câu trả lời.",
    },
    {
      id: "contact",
      label: "Contact",
      description: "Trang liên hệ với form, bản đồ và thông tin cửa hàng.",
    },
    {
      id: "testimonials",
      label: "Testimonials",
      description: "Trang đánh giá từ khách hàng thực tế.",
    },
    {
      id: "gallery",
      label: "Gallery",
      description: "Thư viện ảnh sản phẩm và không gian cửa hàng.",
    },
    {
      id: "shipping",
      label: "Shipping Info",
      description: "Thông tin vận chuyển, phí ship và thời gian giao hàng.",
    },
    {
      id: "pricing",
      label: "Pricing",
      description: "Bảng giá dịch vụ hoặc sản phẩm.",
    },
  ];

  for (const c of candidates) {
    if (!allSeen.has(c.id)) {
      suggestions.push({
        id: c.id,
        label: c.label,
        description: c.description,
        preview: { font: "", palette: [], motion: 0 },
      });
    }
  }

  // Only suggest top 3-4 most relevant based on what's already in prompt
  // If prompt mentioned blog, suggest about + faq as companions
  const maxSuggest = 4;
  return suggestions.slice(0, maxSuggest);
}
