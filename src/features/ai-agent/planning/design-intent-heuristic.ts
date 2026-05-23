export type DesignIntentKind =
  | "init"
  | "update_no_design"
  | "update_token"
  | "redesign";

export type TokenHintRole =
  | "primaryBrand"
  | "accentBrand"
  | "deepSurface"
  | "pageCanvas"
  | "cardSurface"
  | "sectionSurface"
  | "textOnLight"
  | "textOnLightMuted"
  | "textOnDark"
  | "textOnDarkMuted"
  | "error"
  | "warning"
  | "success"
  | "fontFamilyPrimary"
  | "radiusInput"
  | "radiusCard"
  | "radiusPill"
  | "shadowCard"
  | "shadowNav"
  | "shadowFloating";

export type TokenHint = {
  role: TokenHintRole;
  value: string;
  source: "user_prompt";
};

export type DesignIntentLabel =
  | { kind: "init" }
  | { kind: "update_no_design" }
  | { kind: "update_token"; tokenHints: TokenHint[] }
  | { kind: "redesign"; tokenHints?: TokenHint[] };

export type ProjectStatusLike =
  | "empty"
  | "initialized"
  | "error"
  | (string & {});

export const VIBE_PHRASES_REGEX = new RegExp(
  [
    // English vibe markers
    "\\b(luxury|minimalist|maximalist|playful|organic|streetwear|tech|cyber|premium|friendly|elegant|bold|retro|vintage|neon|editorial|handcrafted|monochrome)\\b",
    "\\b(dark mode|light mode|redesign|rebrand)\\b",
    // Vietnamese vibe markers (with diacritics)
    "\\b(sang trọng|tối giản|tối lại|tối hơn|cao cấp|năng động|thanh thiến|thân thiện|tinh tế|cổ điển|hiện đại|sang chảnh)\\b",
    "đổi (vibe|toàn bộ|hướng thiết kế|phong cách|tổng thể|font tổng|giao diện|tone)",
    // Vietnamese ASCII-folded (no diacritics)
    "\\b(sang trong|toi gian|cao cap|nang dong|than thien|tinh te|co dien|hien dai|sang chanh)\\b",
    "doi (vibe|toan bo|huong thiet ke|phong cach|tong the|font tong|giao dien|tone)",
  ].join("|"),
  "i",
);

const COLOR_VALUE_REGEX =
  /(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\))/i;

const QUOTED_FONT_REGEX = /(["'])([A-Za-z][A-Za-z0-9 _-]{1,50})\1/g;

const TOKEN_VERB_PATTERN = new RegExp(
  [
    "(?:đổi|chuyển|set|change)\\s+",
    "(màu|color|font|chữ|chu|radius|bo góc|bo goc|shadow|bóng|bong)",
    "(?:[^.\\n]{0,40})",
    "(?:thành|sang|to|=|->)\\s*",
    "(",
    "#[0-9a-fA-F]{3,8}",
    "|rgba?\\([^)]+\\)",
    "|hsla?\\([^)]+\\)",
    "|oklch\\([^)]+\\)",
    "|\"[^\"\\n]+\"",
    "|'[^'\\n]+'",
    ")",
  ].join(""),
  "gi",
);

const ROLE_KEYWORD_MAP: Array<{
  match: RegExp;
  role: TokenHintRole;
}> = [
  { match: /\b(primary|brand|chính|chinh)\b/i, role: "primaryBrand" },
  { match: /\baccent|cta\b/i, role: "accentBrand" },
  { match: /\b(background|nền|nen|canvas|page)\b/i, role: "pageCanvas" },
  { match: /\b(card|tile)\b/i, role: "cardSurface" },
  { match: /\b(dark|deep|footer|feature band|hero band)\b/i, role: "deepSurface" },
  { match: /\b(error)\b/i, role: "error" },
  { match: /\b(warning)\b/i, role: "warning" },
  { match: /\b(success)\b/i, role: "success" },
  {
    match: /\b(font|chữ|chu|family)\b/i,
    role: "fontFamilyPrimary",
  },
  { match: /\b(radius|bo góc|bo goc)\b/i, role: "radiusPill" },
  { match: /\b(shadow|bóng|bong)\b/i, role: "shadowCard" },
];

const LIGHT_YELLOW_THEME: Record<
  "primaryBrand" | "accentBrand" | "pageCanvas" | "sectionSurface",
  string
> = {
  primaryBrand: "#B45309",
  accentBrand: "#F59E0B",
  pageCanvas: "#FFFBEB",
  sectionSurface: "#FEF3C7",
};

const NATURAL_COLOR_THEMES = [
  {
    match: /\b(light yellow|soft yellow|pale yellow|pastel yellow|vang nhe|vang nhat|mau vang nhe|mau vang nhat)\b/i,
    values: LIGHT_YELLOW_THEME,
  },
];

export function classifyDesignIntent(input: {
  prompt: string;
  projectStatus: ProjectStatusLike;
}): DesignIntentLabel {
  if (input.projectStatus === "empty") {
    return { kind: "init" };
  }

  const prompt = input.prompt.trim();
  const lower = prompt.toLowerCase();
  const folded = stripDiacritics(lower);

  const vibeHit =
    VIBE_PHRASES_REGEX.test(prompt) ||
    VIBE_PHRASES_REGEX.test(lower) ||
    VIBE_PHRASES_REGEX.test(folded);

  const tokenHints = extractTokenHints(prompt);
  const colorOrFontHit =
    COLOR_VALUE_REGEX.test(prompt) ||
    isQuotedFontMention(prompt);

  if (vibeHit) {
    return tokenHints.length > 0
      ? { kind: "redesign", tokenHints }
      : { kind: "redesign" };
  }

  if (tokenHints.length > 0 || colorOrFontHit || matchesTokenVerb(prompt)) {
    return { kind: "update_token", tokenHints };
  }

  if (mentionsDesignTokenCategory(prompt)) {
    return { kind: "update_token", tokenHints: [] };
  }

  return { kind: "update_no_design" };
}

const DESIGN_TOKEN_CATEGORY_REGEX = new RegExp(
  [
    "(?:^|[^a-zA-Z0-9])",
    "(?:đổi|đổi lại|chuyển|set|change|update|sửa|sua|doi|chuyen|sua)",
    "[^.\\n]{0,40}?",
    "(?:^|[^a-zA-Z0-9])",
    "(?:màu|mau|color|colour|font|chữ|chu|family|radius|bo góc|bo goc|shadow|bóng|bong|background|nền|nen|surface|canvas|brand|primary|accent|deep)",
    "(?:[^a-zA-Z0-9]|$)",
  ].join(""),
  "i",
);

function mentionsDesignTokenCategory(prompt: string): boolean {
  return DESIGN_TOKEN_CATEGORY_REGEX.test(prompt);
}

function matchesTokenVerb(prompt: string): boolean {
  const re = new RegExp(TOKEN_VERB_PATTERN.source, "i");
  return re.test(prompt);
}

function isQuotedFontMention(prompt: string): boolean {
  const fontKeyword = /(font|chữ|chu|family)/i;
  if (!fontKeyword.test(prompt)) return false;
  return /(["'])[A-Za-z][^"'\n]{1,50}\1/.test(prompt);
}

export function extractTokenHints(prompt: string): TokenHint[] {
  const hints: TokenHint[] = [];
  const re = new RegExp(TOKEN_VERB_PATTERN.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(prompt)) !== null) {
    const segmentStart = Math.max(0, match.index - 60);
    const context = prompt.slice(segmentStart, match.index + match[0].length);
    const role = inferRole(context, /font|chữ|chu/i.test(match[1]));
    if (!role) continue;
    const value = normalizeHintValue(match[2]);
    if (!value) continue;
    if (hints.some((h) => h.role === role && h.value === value)) continue;
    hints.push({ role, value, source: "user_prompt" });
  }

  // Fallback: explicit "primary <hex>" or hex preceded by a role noun within ~30 chars.
  if (hints.length === 0) {
    const colorAndRole = /(?:^|[^a-z0-9])(primary|accent|background|surface|canvas|brand|deep|footer|hero|chính|chinh)[^.\n]{0,40}?(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\))/gi;
    let m: RegExpExecArray | null;
    while ((m = colorAndRole.exec(prompt)) !== null) {
      const role = inferRole(m[1], false);
      if (!role) continue;
      hints.push({
        role,
        value: normalizeHintValue(m[2]),
        source: "user_prompt",
      });
    }
  }

  if (hints.length === 0) {
    hints.push(...extractNaturalColorHints(prompt));
  }

  return hints;
}

function extractNaturalColorHints(prompt: string): TokenHint[] {
  const folded = stripDiacritics(prompt.toLowerCase());
  const mentionsColorChange =
    /(màu|mau|color|colour|theme|tone|giao diện|giao dien|trang web|website)/i.test(prompt) ||
    /(mau|color|theme|tone|giao dien|trang web|website)/i.test(folded);
  if (!mentionsColorChange) return [];

  const theme = NATURAL_COLOR_THEMES.find((item) => item.match.test(folded));
  if (!theme) return [];

  const explicitRole = inferRole(prompt, false);
  if (explicitRole && explicitRole in theme.values) {
    return [{
      role: explicitRole as keyof typeof theme.values,
      value: theme.values[explicitRole as keyof typeof theme.values],
      source: "user_prompt",
    }];
  }

  const broadThemeRequest =
    /(trang web|website|giao diện|giao dien|theme|tone|toàn bộ|toan bo|site|overall)/i.test(prompt) ||
    /(trang web|website|giao dien|theme|tone|toan bo|site|overall)/i.test(folded);
  if (!broadThemeRequest) {
    return [{
      role: "pageCanvas",
      value: theme.values.pageCanvas,
      source: "user_prompt",
    }];
  }

  return [
    { role: "primaryBrand", value: theme.values.primaryBrand, source: "user_prompt" },
    { role: "accentBrand", value: theme.values.accentBrand, source: "user_prompt" },
    { role: "pageCanvas", value: theme.values.pageCanvas, source: "user_prompt" },
    { role: "sectionSurface", value: theme.values.sectionSurface, source: "user_prompt" },
  ];
}

function inferRole(context: string, isFont: boolean): TokenHintRole | null {
  if (isFont) return "fontFamilyPrimary";
  const lower = context.toLowerCase();
  for (const entry of ROLE_KEYWORD_MAP) {
    if (entry.match.test(lower)) return entry.role;
  }
  return null;
}

function normalizeHintValue(raw: string): string {
  const trimmed = raw.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed.toUpperCase();
  if (/^rgba?\(/i.test(trimmed) || /^hsla?\(/i.test(trimmed) || /^oklch\(/i.test(trimmed)) {
    return trimmed.toLowerCase().replace(/\s+/g, "");
  }
  if (/^["'].*["']$/.test(trimmed)) {
    return trimmed.slice(1, -1).toLowerCase().trim();
  }
  return trimmed;
}

function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function buildDeterministicDesignSeed(input: {
  projectId: string;
  prompt: string;
}): string {
  return hashString(`${input.projectId}:${normalizePromptForDesignSeed(input.prompt)}`).slice(0, 12);
}

export function normalizePromptForDesignSeed(prompt: string): string {
  return stripDiacritics(prompt).toLowerCase().replace(/\s+/g, " ").trim();
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
