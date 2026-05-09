import type { FileManifestEntry, ProjectState } from "../project/project-state.schema";

export type RetrievedFile = { path: string; content: string; reason: string; tokenEstimate: number };

export const RETRIEVAL_LIMITS = {
  maxFiles: 16,
  maxTotalChars: 160000,
  alwaysInclude: ["src/lib/website-config.ts", "src/data/products.ts"],
};

type RetrievalRule = {
  prompt: RegExp;
  file: RegExp;
  reason: string;
};

const STOREFRONT_RULES: RetrievalRule[] = [
  {
    prompt: /filter|lọc|size|color|màu|price|giá|product|sản phẩm/i,
    file: /product|filter|catalog|collection|listing|grid|card|website-config|products/i,
    reason: "Matched product listing/filter request and storefront product files.",
  },
  {
    prompt: /feedback|testimonial|review|đánh giá|khách hàng|nhận xét/i,
    file: /testimonial|review|feedback|home|index|route|landing|website-config/i,
    reason: "Matched testimonial/review request and homepage or review-related files.",
  },
  {
    prompt: /sale|promotion|promo|khuyến mãi|giảm giá|ưu đãi|deal|banner/i,
    file: /promotion|promo|sale|banner|hero|home|index|route|product|website-config/i,
    reason: "Matched promotion/sale request and promotional storefront files.",
  },
  {
    prompt: /mobile|responsive|điện thoại|tablet|desktop|layout|chưa ổn|xấu/i,
    file: /layout|style|css|app|root|home|index|route|product|grid|card|header|footer/i,
    reason: "Matched responsive/layout request and layout/style files.",
  },
  {
    prompt: /luxury|premium|xịn|đẹp|chuyên nghiệp|theme|brand|màu|font|spacing/i,
    file: /theme|style|css|layout|home|index|route|hero|product|card|website-config|header|footer/i,
    reason: "Matched visual/theme improvement request and design-facing files.",
  },
  {
    prompt: /checkout|thanh toán|cart|giỏ hàng|mua hàng|buy|cta|nút mua|add to cart/i,
    file: /checkout|cart|product|card|button|cta|header|route|website-config/i,
    reason: "Matched cart/checkout/CTA request and conversion files.",
  },
  {
    prompt: /header|navigation|nav|menu|footer|search|tìm kiếm/i,
    file: /header|navigation|nav|menu|footer|search|layout|route|website-config/i,
    reason: "Matched navigation/search request and shell files.",
  },
];

const CORE_STOREFRONT_FILE = /(^src\/(routes|components|data|lib)\/|app|root|layout|style|css|config)/i;

export async function retrieveRelevantContext(args: {
  prompt: string;
  projectState: ProjectState;
  readFile: (path: string) => Promise<string>;
}): Promise<RetrievedFile[]> {
  const lower = args.prompt.toLowerCase();
  const candidates = new Map<string, string>();
  const manifest = args.projectState.fileManifest ?? [];

  includeIfPresent(candidates, manifest, RETRIEVAL_LIMITS.alwaysInclude, "Always included storefront context.");
  includeCoreStorefrontFiles(candidates, manifest);

  for (const entry of manifest) {
    const haystack = manifestHaystack(entry);
    if (lower.includes(entry.path.toLowerCase())) {
      candidates.set(entry.path, "Prompt explicitly referenced this file path.");
      continue;
    }

    const matchedRule = STOREFRONT_RULES.find((rule) => rule.prompt.test(lower) && rule.file.test(haystack));
    if (matchedRule) candidates.set(entry.path, matchedRule.reason);
  }

  const files: RetrievedFile[] = [];
  let totalChars = 0;
  for (const [path, reason] of candidates) {
    if (files.length >= RETRIEVAL_LIMITS.maxFiles) break;
    const content = await args.readFile(path).catch(() => "");
    if (!content) continue;
    if (totalChars + content.length > RETRIEVAL_LIMITS.maxTotalChars) continue;
    totalChars += content.length;
    files.push({ path, content, reason, tokenEstimate: Math.ceil(content.length / 4) });
  }
  return files;
}

function includeIfPresent(candidates: Map<string, string>, manifest: FileManifestEntry[], paths: string[], reason: string) {
  const available = new Set(manifest.map((entry) => entry.path));
  for (const path of paths) {
    if (available.has(path)) candidates.set(path, reason);
  }
}

function includeCoreStorefrontFiles(candidates: Map<string, string>, manifest: FileManifestEntry[]) {
  for (const entry of manifest) {
    if (candidates.size >= Math.floor(RETRIEVAL_LIMITS.maxFiles / 2)) return;
    const haystack = manifestHaystack(entry);
    if (entry.kind === "route" || entry.kind === "style" || /website-config|products|layout|root|app|home|index/i.test(haystack)) {
      candidates.set(entry.path, "Core storefront file from current project manifest.");
      continue;
    }
    if (CORE_STOREFRONT_FILE.test(entry.path) && /component|config|data|style|route/i.test(`${entry.kind} ${haystack}`)) {
      candidates.set(entry.path, "Relevant storefront file from current project manifest.");
    }
  }
}

function manifestHaystack(entry: FileManifestEntry) {
  return `${entry.path} ${entry.kind} ${entry.purpose} ${(entry.symbols ?? []).join(" ")}`.toLowerCase();
}
