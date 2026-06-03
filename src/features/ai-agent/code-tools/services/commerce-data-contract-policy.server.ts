export type CommerceDataContractViolation = {
  filePath: string;
  message: string;
};

const FORBIDDEN_SAMPLE_DATA_IMPORT_RE =
  /from\s+['"]@\/data\/(?:products|categories)['"]/;

const CONTRACTS: ReadonlyArray<{
  path: string;
  requiredSnippets: readonly string[];
}> = [
  {
    path: "src/routes/products/index.tsx",
    requiredSnippets: ["useProductsList", "useCategoriesList"],
  },
  {
    path: "src/routes/products/$productId.tsx",
    requiredSnippets: ["useProductDetail", "useCart"],
  },
  {
    path: "src/routes/cart.tsx",
    requiredSnippets: ["useCart", "selectedCartItemIdsAtom"],
  },
  {
    path: "src/components/layout/site-header.tsx",
    requiredSnippets: ["useStore", "useCart", "useProductSuggestions"],
  },
  {
    path: "src/components/store/product-grid.tsx",
    requiredSnippets: ["useProductsList"],
  },
];

export function scanCommerceDataContractPolicy(input: {
  changedFiles: ReadonlyArray<{ path: string; content: string }>;
}): { ok: boolean; violations: CommerceDataContractViolation[] } {
  const violations: CommerceDataContractViolation[] = [];
  for (const file of input.changedFiles) {
    const normalized = file.path.replaceAll("\\", "/");
    if (!isStorefrontContractPath(normalized)) continue;

    if (FORBIDDEN_SAMPLE_DATA_IMPORT_RE.test(file.content)) {
      violations.push({
        filePath: normalized,
        message:
          "Routes and storefront components must use store service hooks, not direct @/data products/categories imports.",
      });
    }

    const contract = CONTRACTS.find((item) => item.path === normalized);
    if (contract) {
      for (const snippet of contract.requiredSnippets) {
        if (!file.content.includes(snippet)) {
          violations.push({
            filePath: normalized,
            message: `Missing required commerce data contract snippet: ${snippet}.`,
          });
        }
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

export function formatCommerceDataContractViolations(
  violations: readonly CommerceDataContractViolation[],
) {
  return violations.map((v) => `${v.filePath}: ${v.message}`).join("\n");
}

function isStorefrontContractPath(path: string) {
  return (
    path.startsWith("src/routes/") ||
    path.startsWith("src/components/store/") ||
    path === "src/components/layout/site-header.tsx"
  );
}
