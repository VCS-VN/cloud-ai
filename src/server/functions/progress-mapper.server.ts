import type { BuilderRunMilestone } from "@/features/agents/ui/builder-events";
import type { BuilderRunKind } from "@/features/agents/ui/builder-run-status";

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
  locale: ProgressLocale = "en",
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
  locale: ProgressLocale = "en",
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

export const THINKING_LABEL: Record<ProgressLocale, string> = {
  vi: "Đang suy nghĩ",
  en: "Thinking",
};

const REASONING_DETAIL_MAX = 140;

/**
 * Best-effort privacy-safe snippet of a reasoning turn, for display under the
 * "Thinking…" label. Reasoning text is usually multi-line; most lines
 * mention file paths/identifiers and fail isPrivacySafe, so this scans line
 * by line for the first safe one instead of checking only the first line.
 * Returns null when no line is safe to show (falls back to the bare label).
 */
export function sanitizeReasoningSnippet(text: string): string | null {
  if (!text) return null;
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (!isPrivacySafe(line)) continue;
    return line.length > REASONING_DETAIL_MAX
      ? `${line.slice(0, REASONING_DETAIL_MAX)}…`
      : line;
  }
  return null;
}

const SUMMARY_MAX_LENGTH = 400;

/**
 * β-lite summary extraction from a codex Turn.finalResponse.
 * Steps: take the first paragraph, trim, run privacy filter, truncate at 400 chars.
 * On any privacy-filter rejection, fall back to the locale-specific phase default.
 */
export function extractSummary(
  turnFinalResponse: string,
  locale: ProgressLocale = "en",
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
  locale: ProgressLocale = "en",
): string {
  return locale === "vi" ? `Đang cập nhật ${section}` : `Updating ${section}`;
}

const RUN_KIND_HEADLINES: Record<
  Exclude<BuilderRunKind, "update" | "new_route" | "repair">,
  Record<ProgressLocale, string>
> = {
  init: { vi: "Storefront của bạn đã sẵn sàng", en: "Your storefront is ready" },
  generate_page: { vi: "Đã dựng xong trang mới", en: "Built the new page" },
  redesign: { vi: "Đã làm mới thiết kế storefront", en: "Redesigned your storefront" },
};

const UPDATE_FALLBACK_HEADLINE: Record<ProgressLocale, string> = {
  vi: "Đã cập nhật storefront của bạn",
  en: "Updated your storefront",
};

const SECTION_LIST_MAX = 4;

function joinSections(sections: string[], locale: ProgressLocale): string {
  if (sections.length === 0) return "";
  if (sections.length === 1) return sections[0]!;
  const and = locale === "vi" ? "và" : "and";
  if (sections.length === 2) return `${sections[0]} ${and} ${sections[1]}`;
  const head = sections.slice(0, -1).join(", ");
  const tail = sections[sections.length - 1];
  return `${head}, ${and} ${tail}`;
}

function buildSectionClause(
  changedFiles: string[],
  locale: ProgressLocale,
): string {
  const seen = new Set<string>();
  const sections: string[] = [];
  for (const path of changedFiles) {
    const section = fileChangeToSection(path, locale);
    if (!section || seen.has(section)) continue;
    seen.add(section);
    sections.push(section);
    if (sections.length >= SECTION_LIST_MAX) break;
  }
  return joinSections(sections, locale);
}

function buildHeadline(
  runKind: BuilderRunKind,
  changedFiles: string[],
  locale: ProgressLocale,
): string {
  if (runKind === "update" || runKind === "new_route" || runKind === "repair") {
    const sections = buildSectionClause(changedFiles, locale);
    if (sections) {
      return locale === "vi" ? `Đã cập nhật ${sections}` : `Updated ${sections}`;
    }
    return UPDATE_FALLBACK_HEADLINE[locale];
  }
  return RUN_KIND_HEADLINES[runKind][locale];
}

// NOTE: `finalResponse` is intentionally appended verbatim, with no privacy
// filter / truncation applied (see commit 46b2d56 "unblock codex SDK
// messages" — the model's own text is shown as-is by design). Only a
// product-copy headline is prepended; do not reintroduce isPrivacySafe /
// extractSummary filtering here.
export function composeAnswerMessage(input: {
  runKind?: BuilderRunKind;
  changedFiles?: string[];
  finalResponse: string;
  locale?: ProgressLocale;
}): string {
  const locale = input.locale ?? "en";
  if (input.runKind === undefined) {
    return input.finalResponse.trim() || SUMMARY_FALLBACK[locale];
  }
  const headline = buildHeadline(input.runKind, input.changedFiles ?? [], locale);
  const rest = input.finalResponse.trim();
  return rest ? `${headline}. ${rest}` : `${headline}.`;
}

// --- Live step-progress labels ----------------------------------------------
// Used by the streaming bridge to fan SDK item.started events into a single
// ephemeral skeleton.update so the UI never sits frozen during a long codex
// turn. All output is privacy-safe by construction (verb-token mapping for
// commands, friendly fallbacks for unknown shapes); the translator still runs
// `isPrivacySafe` as defense-in-depth.

const COMMAND_VERB_LABELS: Record<
  string,
  Record<ProgressLocale, string> | undefined
> = {
  pnpm: { vi: "Đang chạy pnpm", en: "Running pnpm" },
  npm: { vi: "Đang chạy npm", en: "Running npm" },
  yarn: { vi: "Đang chạy yarn", en: "Running yarn" },
  node: { vi: "Đang chạy node", en: "Running node" },
  tsc: { vi: "Đang kiểm tra kiểu", en: "Type-checking" },
  vite: { vi: "Đang chạy vite", en: "Running vite" },
  vitest: { vi: "Đang chạy bài kiểm thử", en: "Running tests" },
  ls: { vi: "Đang đọc thư mục", en: "Reading directory" },
  cat: { vi: "Đang đọc tệp", en: "Reading file" },
  grep: { vi: "Đang tìm trong mã nguồn", en: "Searching source" },
  rg: { vi: "Đang tìm trong mã nguồn", en: "Searching source" },
  find: { vi: "Đang quét tệp", en: "Scanning files" },
};

const COMMAND_FALLBACK: Record<ProgressLocale, string> = {
  vi: "Đang chạy lệnh",
  en: "Running a command",
};

const COMMAND_LABEL_MAX = 80;

/**
 * Friendly localized label for a `command_execution` start. The full command
 * line can include user-supplied paths and shell snippets, so we strip to the
 * first whitespace-delimited token (the verb) and look it up in a curated
 * map. Unknown verbs collapse to the locale fallback. Hard cap 80 chars.
 */
export function commandStepLabel(
  command: string,
  locale: ProgressLocale = "en",
): string {
  const trimmed = command.trim();
  if (!trimmed) return COMMAND_FALLBACK[locale];
  const verb = trimmed.split(/\s+/)[0]?.toLowerCase() ?? "";
  const mapped = COMMAND_VERB_LABELS[verb]?.[locale];
  const label = mapped ?? COMMAND_FALLBACK[locale];
  return label.length > COMMAND_LABEL_MAX
    ? label.slice(0, COMMAND_LABEL_MAX)
    : label;
}

const EDIT_FALLBACK: Record<ProgressLocale, string> = {
  vi: "Đang chỉnh sửa trang",
  en: "Editing the page",
};

/**
 * Friendly localized label for a `file_change` start. Reuses
 * `fileChangeToSection` on the first path; falls back to a generic phrase
 * when no SECTION_TABLE entry matches.
 */
export function editingStepLabel(
  paths: string[],
  locale: ProgressLocale = "en",
): string {
  const first = paths[0];
  if (!first) return EDIT_FALLBACK[locale];
  const section = fileChangeToSection(first, locale);
  if (!section) return EDIT_FALLBACK[locale];
  return locale === "vi" ? `Đang chỉnh sửa ${section}` : `Editing ${section}`;
}

const MCP_TOOL_FALLBACK: Record<ProgressLocale, string> = {
  vi: "Đang tải kỹ năng",
  en: "Loading a skill",
};

/**
 * Friendly localized label for an `mcp_tool_call` start. Skill names can be
 * arbitrary strings so we render a generic phrase rather than echoing them.
 */
export function mcpToolStepLabel(
  _tool: string,
  locale: ProgressLocale = "en",
): string {
  return MCP_TOOL_FALLBACK[locale];
}
