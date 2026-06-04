import { renderPromptDoc } from "../../agent/prompt-template-store.server";

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
    path: "src/routes/__root.tsx",
    requiredSnippets: [
      "import '@vitejs/plugin-react/preamble'",
      "import '@/styles/app.css'",
      "HeadContent",
      "Scripts",
      "<Scripts />",
      "createRootRoute",
      "notFoundComponent",
    ],
  },
  {
    path: "src/routes/products/index.tsx",
    requiredSnippets: ["useProductsList", "useCategoriesList"],
  },
  {
    path: "src/routes/products/$productId.tsx",
    requiredSnippets: [
      "useProductDetail",
      "useCart",
      "ProductModel",
      "selectedModel",
      "setSelectedModel",
      "getItemQuantity",
      "addItem",
      "updateItemQuantity",
    ],
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
  {
    path: "src/app/store-provider.tsx",
    requiredSnippets: ["useStoreDetail", "hasStoreSlug", "lucide-react", "StorefrontLoadingScreen"],
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

    if (normalized === "src/app/store-provider.tsx" && hasForbiddenStorefrontLoadingSkeleton(file.content)) {
      violations.push({
        filePath: normalized,
        message:
          "StorefrontLoadingScreen must use a branded animated icon loading UI, not skeleton components, animate-pulse placeholders, gray bars/boxes, placeholder cards, or simulated storefront layouts.",
      });
    }

    if (normalized === "src/routes/__root.tsx" && !hasRequiredRootRouteImportOrder(file.content)) {
      violations.push({
        filePath: normalized,
        message:
          "Root route must start with import '@vitejs/plugin-react/preamble' followed immediately by import '@/styles/app.css' so hydration and first-paint CSS load correctly.",
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
  return renderPromptDoc("templates/policies/data-contract-policy.md", {
    violations: violations.map((v) => `${v.filePath}: ${v.message}`).join("\n"),
  });
}

function isStorefrontContractPath(path: string) {
  return (
    path.startsWith("src/routes/") ||
    path === "src/app/store-provider.tsx" ||
    path.startsWith("src/components/store/") ||
    path === "src/components/layout/site-header.tsx"
  );
}

function hasForbiddenStorefrontLoadingSkeleton(content: string) {
  return content.includes("animate-pulse")
    || /\bSkeleton\b/.test(content)
    || /\bskeleton\b/i.test(content)
    || /Array\.from\s*\(\s*\{\s*length\s*:/.test(content);
}

function hasRequiredRootRouteImportOrder(content: string) {
  return content.startsWith("import '@vitejs/plugin-react/preamble'\nimport '@/styles/app.css'\n");
}
