export type CustomerCopyViolation = {
  code: string;
  message: string;
  sample: string;
};

export type CustomerCopyScanResult = {
  ok: boolean;
  violations: CustomerCopyViolation[];
};

const FORBIDDEN_CUSTOMER_COPY_PATTERNS: Array<{
  code: string;
  pattern: RegExp;
  message: string;
}> = [
  {
    code: "BUILDER_JARGON_TASTE_SKILL",
    pattern: /taste\s+skill/i,
    message: "Remove builder jargon (taste skill) from customer-facing copy.",
  },
  {
    code: "BUILDER_JARGON_ROUTE_SHELL",
    pattern: /route\s+shell/i,
    message: "Remove builder jargon (route shell) from customer-facing copy.",
  },
  {
    code: "BUILDER_JARGON_THIN_SHELL",
    pattern: /thin\s+shell/i,
    message: "Remove builder jargon (thin shell) from customer-facing copy.",
  },
  {
    code: "BUILDER_JARGON_DESIGN_TASTE",
    pattern: /design\s+taste/i,
    message: "Remove builder jargon (design taste) from customer-facing copy.",
  },
  {
    code: "BUILDER_DEBUG_SHELL",
    pattern: /Shell\s+—/,
    message: "Remove debug shell copy from customer-facing UI.",
  },
  {
    code: "BUILDER_PLACEHOLDER_BUILD",
    pattern: /Build\s+.+\s+using\s+the\s+design/i,
    message: "Replace builder placeholder instructions with retail copy.",
  },
];

export function isStorefrontCustomerCopyPath(filePath: string): boolean {
  return (
    filePath.startsWith("src/routes/") || filePath.startsWith("src/components/")
  );
}

export function scanStorefrontCustomerCopy(input: {
  source: string;
  path?: string;
}): CustomerCopyScanResult {
  if (input.path && !isStorefrontCustomerCopyPath(input.path)) {
    return { ok: true, violations: [] };
  }

  const violations: CustomerCopyViolation[] = [];
  for (const rule of FORBIDDEN_CUSTOMER_COPY_PATTERNS) {
    const match = input.source.match(rule.pattern);
    if (match) {
      violations.push({
        code: rule.code,
        message: rule.message,
        sample: match[0],
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

export function findForbiddenCustomerCopySnippets(source: string): string[] {
  return scanStorefrontCustomerCopy({ source }).violations.map((v) => v.sample);
}

export function hasCatalogUiSignal(
  indexSource: string,
  presentPaths: ReadonlySet<string>,
): boolean {
  if (presentPaths.has("src/components/store/product-grid.tsx")) return true;
  if (
    presentPaths.has("src/components/store/product-card.tsx") &&
    /ProductGrid/.test(indexSource)
  ) {
    return true;
  }
  const usesHook = /useProductsList/.test(indexSource);
  const rendersGrid = /products\.(map|slice)|ProductGrid/.test(indexSource);
  return usesHook && rendersGrid;
}
