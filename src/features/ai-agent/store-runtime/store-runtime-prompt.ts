import { renderPromptDoc } from "../agent/prompt-template-store.server";

export type StoreRuntimePromptInput = {
  selectedStoreSlug?: string | null;
};

export type StoreRuntimePromptContext =
  | {
    selectedStoreSlug: string;
    generatedEnv: {
      name: "VITE_STORE_SLUG";
      value: string;
      scope: "Builder app process owned; read-only for AI Agent";
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

const STORE_RUNTIME_COMMON_PROMPT = "templates/store-runtime/common.md";
const STORE_RUNTIME_EDIT_EXTRA_PROMPT = "templates/store-runtime/edit-extra.md";

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
        scope: "Builder app process owned; read-only for AI Agent",
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

function buildStoreRuntimeContextText(slug: string | null): string {
  if (slug) {
    return [
      `- Current selected store slug: ${slug}.`,
      `- Builder app process owns generated project .env values and contents and should sync VITE_STORE_SLUG=${slug}; AI Agent must treat .env as inaccessible and must not add or update it.`,
    ].join("\n");
  }

  return "- Selected store slug is missing. Do not invent, hardcode, or add a fake or blank VITE_STORE_SLUG.";
}

function buildStoreRuntimeModeInstructions(
  mode: StoreRuntimeInstructionMode,
): string {
  if (mode === "edit") {
    return renderPromptDoc(STORE_RUNTIME_EDIT_EXTRA_PROMPT, {});
  }

  return "- Initialize the four useQuery-managed store data functions during project init so they are present from first generation.";
}

export function buildStoreRuntimeInstructions(input: {
  selectedStoreSlug?: string | null;
  mode?: StoreRuntimeInstructionMode;
}): string {
  const slug = normalizeStoreSlug(input.selectedStoreSlug);
  const mode: StoreRuntimeInstructionMode = input.mode ?? "edit";

  return renderPromptDoc(STORE_RUNTIME_COMMON_PROMPT, {
    storeRuntimeContext: buildStoreRuntimeContextText(slug),
    storeRuntimeModeInstructions: buildStoreRuntimeModeInstructions(mode),
  });
}
