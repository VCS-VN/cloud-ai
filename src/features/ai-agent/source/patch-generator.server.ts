import type { OpenAIProvider } from "../openai/openai-provider.server";
import { ECOMMERCE_AGENT_SYSTEM_PROMPT, PATCH_GENERATOR_PROMPT } from "../openai/prompts";
import { patchResultProviderSchema, patchResultSchema } from "../openai/schemas";
import type { ChangePlan, FileOperation, PatchResult, ProjectState } from "../project/project-state.schema";
import { assertStorefrontImportAliases } from "./import-alias-validator";
import type { RetrievedFile } from "./retrieve-context.server";

export async function generatePatch(args: {
  plan: ChangePlan;
  projectState: ProjectState;
  relevantFiles: RetrievedFile[];
  provider?: OpenAIProvider;
  model?: string;
  prompt?: string;
}): Promise<PatchResult> {
  if (args.provider && args.model) {
    const patch = await args.provider.parseStructured({
      model: args.model,
      system: `${ECOMMERCE_AGENT_SYSTEM_PROMPT}
${PATCH_GENERATOR_PROMPT}
Use null for projectStatePatch or nullable nested fields that do not change.`,
      user: {
        prompt: args.prompt,
        projectState: args.projectState,
        plan: args.plan,
        relevantFiles: args.relevantFiles.map((file) => ({ path: file.path, content: file.content, reason: file.reason })),
      },
      schemaName: "patch_result",
      schema: patchResultProviderSchema,
    }) as PatchResultWithNulls;
    const normalizedPatch = normalizePatchResult(patch, args.projectState);
    assertStorefrontImportAliases(normalizedPatch.operations);
    return normalizedPatch;
  }

  const operations: FileOperation[] = [];
  if (args.plan.affectedFiles.includes("src/components/store/product-filter.tsx")) {
    operations.push({ type: "create_file", path: "src/components/store/product-filter.tsx", content: `export type ProductFilterValue = { size?: string; color?: string; maxPrice?: number }\n\nexport function ProductFilter({ onChange }: { onChange?: (value: ProductFilterValue) => void }) {\n  return (\n    <aside className="grid gap-3 rounded-3xl border p-4">\n      <strong>Filter products</strong>\n      <button type="button" onClick={() => onChange?.({ size: 'M' })}>Size M</button>\n      <button type="button" onClick={() => onChange?.({ color: 'black' })}>Black</button>\n      <button type="button" onClick={() => onChange?.({ maxPrice: 150 })}>Under $150</button>\n    </aside>\n  )\n}\n` });
    operations.push({ type: "create_file", path: "src/lib/product-filter.ts", content: `export type FilterableProduct = { price?: number; attributes?: Record<string, string | number | boolean> }\nexport type ProductFilterValue = { size?: string; color?: string; maxPrice?: number }\n\nexport function filterProducts<T extends FilterableProduct>(products: readonly T[], filter: ProductFilterValue) {\n  return products.filter((product) => {\n    if (filter.maxPrice && (product.price ?? 0) > filter.maxPrice) return false\n    if (filter.size && product.attributes?.size !== filter.size) return false\n    if (filter.color && product.attributes?.color !== filter.color) return false\n    return true\n  })\n}\n` });
    operations.push({ type: "modify_file", path: "src/components/store/product-grid.tsx", content: `import { products } from '@/data/products'\nimport { ProductCard } from '@/components/store/product-card'\nimport { ProductFilter } from '@/components/store/product-filter'\n\nexport function ProductGrid() {\n  return <section className="grid gap-6 px-6 py-12"><ProductFilter /><div className="grid gap-4 md:grid-cols-3">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div></section>\n}\n` });
  }
  const changedFiles = operations.map((operation) => operation.path);
  assertStorefrontImportAliases(operations);
  return {
    summary: args.plan.summary,
    operations,
    changedFiles,
    projectStatePatch: changedFiles.length > 0 ? { features: { ...args.projectState.features, productFilter: true } } : undefined,
  };
}


type PatchResultWithNulls = Omit<PatchResult, "projectStatePatch"> & {
  projectStatePatch: {
    features: Partial<Record<keyof ProjectState["features"], ProjectState["features"][keyof ProjectState["features"]] | null>> | null;
  } | null;
};

function normalizePatchResult(patch: PatchResultWithNulls, projectState: ProjectState): PatchResult {
  const operations = Array.isArray(patch.operations)
    ? patch.operations.filter((operation): operation is FileOperation => {
      if (!operation || typeof operation !== "object") return false;
      if (operation.type === "delete_file") return typeof operation.path === "string" && operation.path.length > 0;
      if (operation.type === "create_file" || operation.type === "modify_file") {
        return typeof operation.path === "string" && operation.path.length > 0 && typeof operation.content === "string";
      }
      return false;
    })
    : [];
  const changedFiles = Array.isArray(patch.changedFiles) && patch.changedFiles.length > 0
    ? patch.changedFiles.filter((path): path is string => typeof path === "string" && path.length > 0)
    : operations.map((operation) => operation.path);
  const featurePatch = patch.projectStatePatch?.features
    ? Object.fromEntries(Object.entries(patch.projectStatePatch.features).filter(([, value]) => value !== null))
    : undefined;
  const normalized = {
    summary: typeof patch.summary === "string" && patch.summary.trim() ? patch.summary : "Applied storefront patch.",
    operations,
    changedFiles,
    projectStatePatch: featurePatch && Object.keys(featurePatch).length > 0
      ? { features: { ...projectState.features, ...featurePatch } as ProjectState["features"] }
      : undefined,
  };
  const result = patchResultSchema.safeParse({
    ...normalized,
    projectStatePatch: normalized.projectStatePatch
      ? { features: Object.fromEntries(Object.entries(normalized.projectStatePatch.features).map(([key, value]) => [key, value ?? null])) }
      : null,
  });
  if (!result.success) {
    const summary = result.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
    throw new Error(`PATCH_RESULT_SCHEMA_INVALID: ${summary}`);
  }
  return normalized;
}
