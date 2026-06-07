import type { BuilderRunMilestone } from "@/features/agents/ui/builder-events";

export type ProgressLocale = "vi" | "en";

const PHASE_LABELS: Record<BuilderRunMilestone, Record<ProgressLocale, string>> = {
  loading_context: {
    vi: "Đang đọc cấu trúc trang",
    en: "Reading page structure",
  },
  planning: {
    vi: "Đang lên kế hoạch chỉnh sửa",
    en: "Planning the edit",
  },
  creating_draft: {
    vi: "Đang chuẩn bị bản nháp",
    en: "Preparing draft workspace",
  },
  building_pages: {
    vi: "Đang dựng các trang/khối",
    en: "Building pages and sections",
  },
  checking_preview: {
    vi: "Đang kiểm tra preview",
    en: "Checking the preview",
  },
  repairing: {
    vi: "Đang tự sửa các lỗi nhỏ",
    en: "Self-healing small errors",
  },
  publishing: {
    vi: "Đang lưu thay đổi",
    en: "Publishing changes",
  },
  awaiting_clarification: {
    vi: "Đang chờ bạn xác nhận lựa chọn",
    en: "Waiting for your selection",
  },
  done: { vi: "Hoàn tất", en: "Done" },
  failed: { vi: "Đã xảy ra lỗi", en: "An error occurred" },
  cancelled: { vi: "Đã huỷ", en: "Cancelled" },
};

export function phaseLabel(
  phase: BuilderRunMilestone,
  locale: ProgressLocale = "vi",
): string {
  return PHASE_LABELS[phase][locale];
}

type SectionEntry = {
  match: (path: string) => boolean;
  vi: string;
  en: string;
};

const SECTION_TABLE: SectionEntry[] = [
  {
    match: (p) => p === "src/routes/index.tsx",
    vi: "trang chủ",
    en: "the home page",
  },
  {
    match: (p) => p === "src/routes/products/index.tsx",
    vi: "trang danh sách sản phẩm",
    en: "the products page",
  },
  {
    match: (p) => /^src\/routes\/products\/\$[A-Za-z0-9_]+\.tsx$/.test(p),
    vi: "trang chi tiết sản phẩm",
    en: "the product detail page",
  },
  {
    match: (p) => p === "src/routes/cart.tsx",
    vi: "trang giỏ hàng",
    en: "the cart page",
  },
  {
    match: (p) => p === "src/routes/checkout.tsx",
    vi: "trang thanh toán",
    en: "the checkout page",
  },
  {
    match: (p) => p === "src/routes/__root.tsx",
    vi: "khung chung của site",
    en: "the global frame",
  },
  {
    match: (p) => /^src\/components\/storefront\/Hero\.[\w.]+$/.test(p),
    vi: "phần hero",
    en: "the hero section",
  },
  {
    match: (p) => /^src\/components\/storefront\/ProductCard\.[\w.]+$/.test(p),
    vi: "khối sản phẩm",
    en: "the product tile",
  },
  {
    match: (p) => /^src\/components\/storefront\/ProductGrid\.[\w.]+$/.test(p),
    vi: "khu sản phẩm",
    en: "the product grid",
  },
  {
    match: (p) => /^src\/components\/storefront\/Header\.[\w.]+$/.test(p),
    vi: "phần đầu trang",
    en: "the header",
  },
  {
    match: (p) => /^src\/components\/storefront\/Footer\.[\w.]+$/.test(p),
    vi: "phần chân trang",
    en: "the footer",
  },
  {
    match: (p) => /^src\/components\/storefront\/CartDrawer\.[\w.]+$/.test(p),
    vi: "ngăn kéo giỏ hàng",
    en: "the cart drawer",
  },
  {
    match: (p) =>
      /^src\/components\/storefront\/(Banner|Promo)\.[\w.]+$/.test(p),
    vi: "banner khuyến mãi",
    en: "the promo banner",
  },
  {
    match: (p) => p === "src/styles/app.css" || p === "DESIGN.md",
    vi: "hệ thống thiết kế",
    en: "the design system",
  },
  {
    match: (p) => p.startsWith("src/components/"),
    vi: "một phần của giao diện",
    en: "a UI section",
  },
];

export function fileChangeToSection(
  filePath: string,
  locale: ProgressLocale = "vi",
): string | null {
  for (const entry of SECTION_TABLE) {
    if (entry.match(filePath)) return entry[locale];
  }
  return null;
}

const FRAMEWORK_TOKENS = [
  "tsx",
  "jsx",
  "vite",
  "tanstack",
  "drizzle",
  "eslint",
  "prettier",
  "pnpm",
  "npm",
  "yarn",
  "tailwind",
  "react",
  "node_modules",
  "pm2",
  "playwright",
  "vitest",
];

const FILE_EXT_PATTERN =
  /[\w./-]+\.(?:tsx?|jsx?|css|scss|json|md|sql|sh|ya?ml)\b/i;
const MULTI_SEGMENT_PATH = /(?:^|\s|`)\/?[\w-]+\/[\w./-]+/;
const CODE_IDENT_BACKTICK = /`[\w_$]{3,}`/;
const CODE_FENCE = /```/;
const HTML_JSX_TAG = /<\/?[A-Za-z][\w-]*(?:\s|>|\/)/;

const FRAMEWORK_TOKEN_RE = new RegExp(
  `\\b(?:${FRAMEWORK_TOKENS.join("|")})\\b`,
  "i",
);

export function isPrivacySafe(text: string): boolean {
  if (!text) return true;
  if (FILE_EXT_PATTERN.test(text)) return false;
  if (MULTI_SEGMENT_PATH.test(text)) return false;
  if (CODE_IDENT_BACKTICK.test(text)) return false;
  if (CODE_FENCE.test(text)) return false;
  if (HTML_JSX_TAG.test(text)) return false;
  if (FRAMEWORK_TOKEN_RE.test(text)) return false;
  return true;
}

const SUMMARY_FALLBACK: Record<ProgressLocale, string> = {
  vi: "Đã hoàn tất yêu cầu của bạn.",
  en: "Done with your request.",
};

const SUMMARY_MAX_LENGTH = 400;

/**
 * β-lite summary extraction from a codex Turn.finalResponse.
 * Steps: take the first paragraph, trim, run privacy filter, truncate at 400 chars.
 * On any privacy-filter rejection, fall back to the locale-specific phase default.
 */
export function extractSummary(
  turnFinalResponse: string,
  locale: ProgressLocale = "vi",
): string {
  if (!turnFinalResponse) return SUMMARY_FALLBACK[locale];
  const firstParagraph =
    turnFinalResponse.split(/\n{2,}/)[0]?.trim() ?? "";
  if (!firstParagraph) return SUMMARY_FALLBACK[locale];
  if (!isPrivacySafe(firstParagraph)) return SUMMARY_FALLBACK[locale];
  if (firstParagraph.length <= SUMMARY_MAX_LENGTH) return firstParagraph;
  return firstParagraph.slice(0, SUMMARY_MAX_LENGTH);
}

export function sectionFraming(
  section: string,
  locale: ProgressLocale = "vi",
): string {
  return locale === "vi" ? `Đang cập nhật ${section}` : `Updating ${section}`;
}
