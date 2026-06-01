export const DESIGN_TOKEN_PROVENANCE_VALUES = [
  "user",
  "agent",
  "fallback-agent",
  "system",
] as const;

export type DesignTokenProvenance =
  (typeof DESIGN_TOKEN_PROVENANCE_VALUES)[number];

export const PHASE1_COLOR_TOKEN_KEYS = [
  "primary",
  "primary-foreground",
  "accent",
  "accent-foreground",
  "highlight",
  "highlight-foreground",
  "background",
  "surface",
  "surface-muted",
  "foreground",
  "muted-foreground",
  "border",
  "success",
  "warning",
  "error",
] as const;

export type Phase1ColorTokenKey = (typeof PHASE1_COLOR_TOKEN_KEYS)[number];

export const PHASE1_TYPOGRAPHY_TOKEN_KEYS = [
  "display",
  "hero",
  "h1",
  "h2",
  "h3",
  "body",
  "body-sm",
  "button",
  "caption",
] as const;

export const PHASE1_RADIUS_TOKEN_KEYS = [
  "sm",
  "md",
  "lg",
  "xl",
  "pill",
  "full",
] as const;

export const PHASE1_SPACING_TOKEN_KEYS = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "section",
] as const;

export const PHASE1_SHADOW_TOKEN_KEYS = ["card", "nav", "floating"] as const;

export const PHASE1_COMPONENT_TOKEN_KEYS = [
  "button-primary",
  "button-secondary",
  "card-product",
  "badge-sale",
] as const;

export const PHASE1_TOKEN_GROUP_KEYS = [
  "colors",
  "typography",
  "spacing",
  "radius",
  "shadows",
  "components",
] as const;

export const APPROVED_SEMANTIC_COLOR_UTILITIES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "muted",
  "muted-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "highlight",
  "highlight-foreground",
  "success",
  "warning",
  "error",
  "deep",
  "deep-foreground",
] as const;

export type DesignTokenEntry = {
  value: string;
  valueDark?: string;
  provenance?: DesignTokenProvenance;
  role?: string;
};

export type DesignTokenBlock = {
  designIntent?: Record<string, unknown>;
  tokens?: Record<string, Record<string, DesignTokenEntry | string>>;
};

export function readTokenValue(entry: DesignTokenEntry | string | undefined): string | undefined {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return undefined;
  return typeof entry.value === "string" ? entry.value : undefined;
}

export function readTokenValueDark(
  entry: DesignTokenEntry | string | undefined,
): string | undefined {
  if (!entry || typeof entry !== "object") return undefined;
  return typeof entry.valueDark === "string" && entry.valueDark ? entry.valueDark : undefined;
}

/**
 * Distilled taste-skill "dials" (Section 1) persisted into DESIGN.md designIntent.
 * Bounds are the commerce ceiling applied by clampDials; see design-dials.server.ts.
 */
export const DESIGN_DIAL_KEYS = ["variance", "motion", "density"] as const;
export type DesignDialKey = (typeof DESIGN_DIAL_KEYS)[number];

export const DESIGN_DIAL_BOUNDS: Record<DesignDialKey, { min: number; max: number }> = {
  variance: { min: 1, max: 8 },
  motion: { min: 1, max: 5 },
  density: { min: 3, max: 6 },
};

/** Distilled taste-skill "locks" (Section 1) persisted into DESIGN.md designIntent. */
export const DESIGN_LOCK_KEYS = ["colorLock", "radiusLock", "themeLock"] as const;
export type DesignLockKey = (typeof DESIGN_LOCK_KEYS)[number];

export const RADIUS_LOCK_VALUES = ["all-sharp", "all-soft", "all-pill"] as const;
export const THEME_LOCK_VALUES = ["light", "dark", "dual"] as const;

export type DesignDials = {
  variance: number;
  motion: number;
  density: number;
  designRead: string;
  colorLock: string;
  radiusLock: (typeof RADIUS_LOCK_VALUES)[number];
  themeLock: (typeof THEME_LOCK_VALUES)[number];
};
