export type StoreRuntimePromptInput = {
  selectedStoreSlug?: string | null;
};

export type StoreRuntimePromptContext =
  | {
      selectedStoreSlug: string;
      generatedEnv: {
        name: "VITE_STORE_SLUG";
        value: string;
        scope: "generated project-detail .env files only";
      };
      storeRuntimeContract: {
        realDataEnabledBy: "import.meta.env.VITE_STORE_SLUG";
        queryStateLibrary: "useQuery";
        mockFallbackWhenSlugMissing: true;
        demoFallbackWhenSlugPresentAndStoreDetailFails: false;
      };
    }
  | {
      selectedStoreSlug: null;
      generatedEnv: {
        name: "VITE_STORE_SLUG";
        action: "do not add fake or blank value";
      };
      storeRuntimeContract: {
        mockFallbackWhenSlugMissing: true;
      };
    };

export function normalizeStoreSlug(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function buildStoreRuntimePromptContext(
  input: StoreRuntimePromptInput,
): StoreRuntimePromptContext {
  const slug = normalizeStoreSlug(input.selectedStoreSlug);
  if (slug) {
    return {
      selectedStoreSlug: slug,
      generatedEnv: {
        name: "VITE_STORE_SLUG",
        value: slug,
        scope: "generated project-detail .env files only",
      },
      storeRuntimeContract: {
        realDataEnabledBy: "import.meta.env.VITE_STORE_SLUG",
        queryStateLibrary: "useQuery",
        mockFallbackWhenSlugMissing: true,
        demoFallbackWhenSlugPresentAndStoreDetailFails: false,
      },
    };
  }

  return {
    selectedStoreSlug: null,
    generatedEnv: {
      name: "VITE_STORE_SLUG",
      action: "do not add fake or blank value",
    },
    storeRuntimeContract: {
      mockFallbackWhenSlugMissing: true,
    },
  };
}

export type StoreRuntimeInstructionMode = "init" | "edit";

export function buildStoreRuntimeInstructions(input: {
  selectedStoreSlug?: string | null;
  mode?: StoreRuntimeInstructionMode;
}): string {
  const slug = normalizeStoreSlug(input.selectedStoreSlug);
  const mode: StoreRuntimeInstructionMode = input.mode ?? "edit";
  const lines: string[] = [];

  lines.push("Store Runtime Contract:");
  lines.push(
    "- Source of truth for the current selected store slug is the Builder Project entity store slug field, never ProjectState.",
  );

  if (slug) {
    lines.push(`- Current selected store slug: ${slug}.`);
    lines.push(
      `- Generated project-detail .env MUST contain VITE_STORE_SLUG=${slug}. Add it when missing or update it when stale.`,
    );
  } else {
    lines.push(
      "- Selected store slug is missing. Do not invent, hardcode, or add a fake or blank VITE_STORE_SLUG.",
    );
  }

  lines.push(
    "- Env edits are allowed only inside generated project-detail .env files. Never edit repository-level or Builder application .env or secret files.",
  );
  lines.push("- Preserve unrelated environment variables when adding or updating VITE_STORE_SLUG.");
  lines.push(
    "- Generated storefront code MUST handle store detail, products list, product detail, and categories list state via useQuery from @tanstack/react-query, with enabled tied to import.meta.env.VITE_STORE_SLUG.",
  );
  lines.push("- Required generated store data functions and contracts:");
  lines.push("  - GET /api/v1/stores/:storeSlug for store detail.");
  lines.push(
    "  - GET /api/v1/products with query params limit, page, storeId, query for products list. Response shape MUST stay compatible with the existing sample ProductsList { total, data } contract.",
  );
  lines.push(
    "  - GET /api/v1/products/:productId for product detail with default query params isGettingModel=true and isGettingDefaultModel=true.",
  );
  lines.push("  - GET /api/v1/categories with query param storeId for categories list.");
  lines.push(
    "- Do not invent additional store API endpoints, query params, or response schemas beyond the four listed contracts.",
  );
  lines.push(
    "- When VITE_STORE_SLUG is missing, generated storefront code MUST keep using existing sample mocked data and MUST NOT call these server data functions.",
  );
  lines.push(
    "- When VITE_STORE_SLUG exists and store detail loading fails, generated code MUST show a store-detail load error UI with a retry/refetch button and MUST NOT silently fall back to demo store data.",
  );
  lines.push(
    "- Generated storefront UI MUST follow DESIGN.md tokens for loading, empty, error, and retry states.",
  );

  if (mode === "edit") {
    lines.push(
      "- Preserve existing VITE_STORE_SLUG and real store data loading behavior during unrelated edits. Do not replace real data with hardcoded sample products or categories when VITE_STORE_SLUG exists.",
    );
    lines.push(
      "- Remove the store runtime contract only when the user explicitly requests removal.",
    );
  } else {
    lines.push(
      "- Initialize the four useQuery-managed store data functions during project init so they are present from first generation.",
    );
  }

  return lines.join("\n");
}
