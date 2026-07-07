import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildStoreSampleDataInstructions } from "@/ai/prompt-builder";

async function readTemplate(relPath: string): Promise<string> {
  return fs.readFile(path.resolve(process.cwd(), relPath), "utf8");
}

describe("codex storefront instruction guardrails", () => {
  it("requires opaque token-backed surfaces for shadcn overlays and suggestions", async () => {
    const [uiRules, componentSpec, initSystem, editSystem] = await Promise.all([
      readTemplate("templates/project-rules/ui-design.md"),
      readTemplate("templates/codex-builder/init/data/component.md"),
      readTemplate("templates/codex-builder/init/system.md"),
      readTemplate("templates/codex-builder/foundation/edit-system.md"),
    ]);

    for (const body of [uiRules, componentSpec, initSystem, editSystem]) {
      expect(body).toContain("bg-popover");
      expect(body).toContain("text-popover-foreground");
      expect(body).toContain("border-border");
    }

    expect(componentSpec).toContain(
      "page/header backgrounds must never show through suggestion rows",
    );
    expect(initSystem).toContain("SHADCN PRIMITIVE STYLING RULES");
    expect(editSystem).toContain(
      "Shadcn UI primitives in `src/components/ui/*` are runtime-owned",
    );
  });

  it("forbids product-detail render-loop state sync from query data", async () => {
    const [uiRules, productDetailSpec, initSystem, editSystem] =
      await Promise.all([
        readTemplate("templates/project-rules/ui-design.md"),
        readTemplate("templates/codex-builder/init/pages/product-detail.md"),
        readTemplate("templates/codex-builder/init/system.md"),
        readTemplate("templates/codex-builder/foundation/edit-system.md"),
      ]);

    for (const body of [uiRules, productDetailSpec, initSystem, editSystem]) {
      expect(body).toContain("useEffect");
      expect(body).toContain("useMemo");
      expect(body).toContain("product");
      expect(body).toContain("models");
      expect(body).toContain("images");
    }

    expect(productDetailSpec).toContain("RENDER-LOOP GUARD (STRICT)");
    expect(productDetailSpec).toContain(
      "Track `selectedModelId` with `useState<string | null>(null)`",
    );
    expect(productDetailSpec).toContain(
      "Do not reset selectedImageIndex in an effect",
    );
    expect(initSystem).toContain("NO RENDER-LOOP STATE SYNC");
    expect(editSystem).toContain("Avoid render-loop state sync");
  });

  it("requires optional chaining and nullish fallbacks for every generated data/entity read", async () => {
    const [
      dataRules,
      productDetailSpec,
      initSystem,
      editSystem,
      storeRuntime,
      codeAgent,
    ] = await Promise.all([
      readTemplate("templates/project-rules/data-contract.md"),
      readTemplate("templates/codex-builder/init/pages/product-detail.md"),
      readTemplate("templates/codex-builder/init/system.md"),
      readTemplate("templates/codex-builder/foundation/edit-system.md"),
      readTemplate("templates/store-runtime/common.md"),
      readTemplate("templates/code-agent/developer.md"),
    ]);

    for (const body of [
      dataRules,
      initSystem,
      editSystem,
      storeRuntime,
      codeAgent,
    ]) {
      expect(body).toContain("optional chaining");
      expect(body).toContain("nullish");
      expect(body).toContain("every data/entity");
      expect(body).toContain("store?.name?.trim()");
      expect(body).toContain("product?.descriptions?.trim()");
      expect(body).toContain("storeDetail?.setting?.currency ?? 'AUD'");
      expect(body).toContain("product?.category?.name");
      expect(body).toContain("product?.images?.[0]");
      expect(body).toContain("product?.models?.[0]?.name");
      expect(body).toContain("product?.models?.length");
    }

    for (const body of [productDetailSpec, initSystem, editSystem]) {
      expect(body).toContain("optional chaining");
      expect(body).toContain("nullish");
      expect(body).toContain("product?.category?.name");
      expect(body).toContain("product?.images?.[0]");
      expect(body).toContain("product?.models?.length");
    }

    expect(dataRules).toContain("(order?.items ?? []).map(...)");
    expect(productDetailSpec).toContain("missing-product UI when `!product`");
    expect(productDetailSpec).toContain("Never write `product.category.name`");
    expect(productDetailSpec).toContain(
      "never call `.map` or `.length` on product.models directly",
    );
    expect(initSystem).toContain("SAFE DATA ACCESS RULES");
    expect(initSystem).toContain(
      "Treat optional chaining as the default style",
    );
    expect(initSystem).toContain("(order?.items ?? []).map(...)");
    expect(editSystem).toContain(
      "Product detail updates must return loading/error/missing-product UI",
    );
    expect(storeRuntime).toContain(
      "Treat optional chaining as the default style",
    );
    expect(codeAgent).toContain("Treat optional chaining as the default style");
  });

  it("forbids Tailwind v3 @apply with group or peer marker utilities", async () => {
    const [uiRules, initSystem, editSystem, builderRunSource] =
      await Promise.all([
        readTemplate("templates/project-rules/ui-design.md"),
        readTemplate("templates/codex-builder/init/system.md"),
        readTemplate("templates/codex-builder/foundation/edit-system.md"),
        readTemplate("src/features/agents/codex/runtime/builder-run.server.ts"),
      ]);

    for (const body of [uiRules, initSystem, editSystem]) {
      expect(body).toContain("@apply group");
      expect(body).toContain("@apply peer");
      expect(body).toContain("group-hover:*");
      expect(body).toContain("peer-hover:*");
      expect(body).toContain("group-*");
      expect(body).toContain("peer-*");
      expect(body).toContain("JSX");
    }

    expect(initSystem).toContain("TAILWIND V3 @apply RULES");
    expect(initSystem).toContain(
      "@apply should not be used with the 'group' utility",
    );
    expect(editSystem).toContain(
      "@apply should not be used with the 'group' utility",
    );
    expect(builderRunSource).toContain("tailwind_v3_apply_rules");
    expect(builderRunSource).toContain(
      "@apply should not be used with the 'group' utility",
    );
  });

  it("requires explicit product model selection, cart payload, toasts, quantity sync, and read-more behavior", async () => {
    const [uiRules, productDetailSpec, storeRuntime] = await Promise.all([
      readTemplate("templates/project-rules/ui-design.md"),
      readTemplate("templates/codex-builder/init/pages/product-detail.md"),
      readTemplate("templates/store-runtime/common.md"),
    ]);

    for (const body of [productDetailSpec, storeRuntime]) {
      expect(body).toContain("preselect defaultModel or models[0]");
      expect(body).toContain("selectedModelId");
      expect(body).toContain("null");
      expect(body).toContain("getItemQuantity(model.id)");
      expect(body).toContain(
        "toast.error('Please choose a product option first')",
      );
      expect(body).toContain(
        "const payload = { product, model: selectedModel, quantity }",
      );
      expect(body).toContain("addItem(payload)");
      expect(body).toContain("toast.success");
      expect(body).toContain("Read more / Read less");
      expect(body).not.toContain(
        "Add/update button is disabled until selectedModel.id exists",
      );
      expect(body).not.toContain(
        "confirm button is disabled until selectedModel.id exists",
      );
    }

    expect(productDetailSpec).toContain(
      "Do NOT disable the button merely because selectedModel is missing",
    );
    expect(productDetailSpec).toContain(
      "the quantity input MUST show the existing cart quantity when the model is selected",
    );
    expect(productDetailSpec).toContain(
      "PRIMARY BUTTON STATE MACHINE (STRICT — five branches)",
    );
    expect(productDetailSpec).toContain("label is Remove from cart");
    expect(productDetailSpec).toContain(
      "calls removeItem(selectedModel.id) — do NOT use updateItemQuantity(id, 0) to remove",
    );
    expect(productDetailSpec).toContain("label is Add to cart, DISABLED");
    expect(productDetailSpec).toContain(
      "resets `selectedModelId` to null and quantity to 1",
    );
    expect(productDetailSpec).toContain("toast.success('Added to cart')");
    expect(productDetailSpec).toContain("toast.success('Cart updated')");
    expect(productDetailSpec).toContain("toast.success('Removed from cart')");
    expect(productDetailSpec).toContain("DESCRIPTION_THRESHOLD = 120");
    expect(productDetailSpec).toContain(
      "The primary button INSIDE the sheet MUST follow the exact same five-branch",
    );
    expect(uiRules).toContain("Do not preselect a product model");
    expect(uiRules).toContain("sync the quantity input from the cart");
  });

  it("keeps legacy store prompt guidance aligned with overlay and render-loop guardrails", () => {
    const prompt = buildStoreSampleDataInstructions();

    expect(prompt).toContain("opaque semantic surface");
    expect(prompt).toContain("bg-popover text-popover-foreground");
    expect(prompt).toContain("never use useEffect to copy product/query data");
    expect(prompt).toContain(
      "useState<string | null>(null) for selectedModelId",
    );
    expect(prompt).toContain("optional chaining and nullish fallbacks");
    expect(prompt).toContain("every data/entity read at every nested level");
    expect(prompt).toContain("store?.name?.trim()");
    expect(prompt).toContain("product?.descriptions?.trim()");
    expect(prompt).toContain("product?.models?.[0]?.name");
    expect(prompt).toContain("(product?.models ?? []).map(...)");
    expect(prompt).toContain(
      "missing-product UI before reading product fields",
    );
    expect(prompt).toContain("initial selectedModelId is null");
    expect(prompt).toContain(
      "toast.error('Please choose a product option first')",
    );
    expect(prompt).toContain(
      "const payload = { product, model: selectedModel, quantity }",
    );
    expect(prompt).toContain("toast.success");
    expect(prompt).not.toContain(
      "rounded-2xl bg-white p-3 shadow-lg shadow-black/5",
    );
    expect(prompt).not.toContain(
      "useState<ProductModel | undefined>(undefined) with initialModel",
    );
  });

  it("generates preview-safe Vite config, dev command, and checkout placeholders", async () => {
    const [packageTemplate, viteConfigTemplate, checkoutSpec] =
      await Promise.all([
        readTemplate("templates/codex-builder/init/settings/package.json.md"),
        readTemplate("templates/codex-builder/init/settings/vite.config.ts.md"),
        readTemplate("templates/codex-builder/init/pages/checkout.md"),
      ]);

    expect(packageTemplate).toContain('"dev": "tsr generate && vite dev"');
    expect(viteConfigTemplate).toContain("process.env.VITE_PROJECT_ID");
    expect(viteConfigTemplate).toContain(
      "process.env.VITE_PREVIEW_PUBLIC_HOST",
    );
    expect(viteConfigTemplate).toContain(
      "`${previewProjectId}-preview.${previewDomain}`",
    );
    expect(viteConfigTemplate).toContain("server:");
    expect(viteConfigTemplate).toContain("allowedHosts: [previewHost]");
    expect(checkoutSpec).toContain("Inputs MUST be empty by default");
    expect(checkoutSpec).toContain("placeholder props only");
    expect(checkoutSpec).toContain(
      "Do NOT seed form defaultValues with fake customer data",
    );
    expect(checkoutSpec).toContain("John Doe");
    expect(checkoutSpec).toContain("postal code");
  });
});
