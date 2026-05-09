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
    const repairedPatch = ensureVisibleStorefrontPatch(normalizedPatch, args);
    assertStorefrontImportAliases(repairedPatch.operations);
    return repairedPatch;
  }

  const operations: FileOperation[] = [];
  if (args.plan.affectedFiles.includes("src/components/store/product-filter.tsx")) {
    operations.push({ type: "create_file", path: "src/components/store/product-filter.tsx", content: `export type ProductFilterValue = { size?: string; color?: string; maxPrice?: number }\n\nexport function ProductFilter({ onChange }: { onChange?: (value: ProductFilterValue) => void }) {\n  return (\n    <aside className="grid gap-3 rounded-3xl border p-4">\n      <strong>Filter products</strong>\n      <button type="button" onClick={() => onChange?.({ size: 'M' })}>Size M</button>\n      <button type="button" onClick={() => onChange?.({ color: 'black' })}>Black</button>\n      <button type="button" onClick={() => onChange?.({ maxPrice: 150 })}>Under $150</button>\n    </aside>\n  )\n}\n` });
    operations.push({ type: "create_file", path: "src/lib/product-filter.ts", content: `export type FilterableProduct = { price?: number; attributes?: Record<string, string | number | boolean> }\nexport type ProductFilterValue = { size?: string; color?: string; maxPrice?: number }\n\nexport function filterProducts<T extends FilterableProduct>(products: readonly T[], filter: ProductFilterValue) {\n  return products.filter((product) => {\n    if (filter.maxPrice && (product.price ?? 0) > filter.maxPrice) return false\n    if (filter.size && product.attributes?.size !== filter.size) return false\n    if (filter.color && product.attributes?.color !== filter.color) return false\n    return true\n  })\n}\n` });
    operations.push({ type: "modify_file", path: "src/components/store/product-grid.tsx", content: `import { products } from '@/data/products'\nimport { ProductCard } from '@/components/store/product-card'\nimport { ProductFilter } from '@/components/store/product-filter'\n\nexport function ProductGrid() {\n  return <section className="grid gap-6 px-6 py-12"><ProductFilter /><div className="grid gap-4 md:grid-cols-3">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div></section>\n}\n` });
  }
  const fallbackPatch = ensureVisibleStorefrontPatch({
    summary: args.plan.summary,
    operations,
    changedFiles: operations.map((operation) => operation.path),
    projectStatePatch: operations.length > 0 ? { features: { ...args.projectState.features, productFilter: true } } : undefined,
  }, args);
  assertStorefrontImportAliases(fallbackPatch.operations);
  return fallbackPatch;
}



function ensureVisibleStorefrontPatch(patch: PatchResult, args: {
  plan: ChangePlan;
  projectState: ProjectState;
  relevantFiles: RetrievedFile[];
  prompt?: string;
}): PatchResult {
  if (patch.operations.length > 0) return patch;

  const prompt = `${args.prompt ?? ""} ${args.plan.summary}`.toLowerCase();
  const fileMap = new Map(args.relevantFiles.map((file) => [file.path, file.content]));
  const operations: FileOperation[] = [];

  if (/feedback|testimonial|review|đánh giá|khách hàng|nhận xét/.test(prompt)) {
    const operation = buildHomepageSectionPatch(fileMap, {
      marker: "agent-testimonials-section",
      summary: "Thêm feedback khách hàng nổi bật vào homepage.",
      jsx: `<section className="agent-testimonials-section mx-6 my-12 rounded-[2rem] bg-slate-950 px-6 py-10 text-white shadow-2xl"><p className="text-sm uppercase tracking-[0.3em] text-white/60">Khách hàng nói gì</p><h2 className="mt-3 text-3xl font-semibold">Trải nghiệm mua sắm được tin chọn</h2><div className="mt-6 grid gap-4 md:grid-cols-3"><blockquote className="rounded-3xl bg-white/10 p-5">“Sản phẩm đẹp, đóng gói kỹ và giao rất nhanh.”<footer className="mt-4 text-sm text-white/70">Minh Anh</footer></blockquote><blockquote className="rounded-3xl bg-white/10 p-5">“Website dễ mua, ưu đãi rõ ràng, tư vấn nhiệt tình.”<footer className="mt-4 text-sm text-white/70">Quốc Bảo</footer></blockquote><blockquote className="rounded-3xl bg-white/10 p-5">“Mình quay lại mua lần hai vì chất lượng rất ổn.”<footer className="mt-4 text-sm text-white/70">Thu Hà</footer></blockquote></div></section>`,
    });
    if (operation) operations.push(operation);
  } else if (/mobile|responsive|điện thoại|tablet|desktop|layout|chưa ổn|xấu/.test(prompt)) {
    const operation = buildProductGridPatch(fileMap, "responsive");
    if (operation) operations.push(operation);
  } else if (/nút mua|cta|buy|add to cart|mua hàng|cart|giỏ hàng/.test(prompt)) {
    const operation = buildProductCardPatch(fileMap, "cta");
    if (operation) operations.push(operation);
  } else if (/sale|promotion|promo|khuyến mãi|giảm giá|ưu đãi|deal|banner/.test(prompt)) {
    const operation = buildHomepageSectionPatch(fileMap, {
      marker: "agent-promotion-section",
      summary: "Thêm khu vực ưu đãi nổi bật vào storefront.",
      jsx: `<section className="agent-promotion-section mx-6 my-10 rounded-[2rem] border border-amber-200 bg-amber-50 px-6 py-8 text-slate-950"><p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-700">Ưu đãi nổi bật</p><h2 className="mt-3 text-3xl font-bold">Sale chọn lọc cho đơn hàng hôm nay</h2><p className="mt-3 max-w-2xl text-slate-700">Làm nổi bật sản phẩm đang khuyến mãi, tạo cảm giác cấp bách và giúp khách hàng ra quyết định nhanh hơn.</p><a className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-semibold text-white" href="/products">Xem sản phẩm sale</a></section>`,
    });
    if (operation) operations.push(operation);
  } else {
    const operation = buildHomepageSectionPatch(fileMap, {
      marker: "agent-storefront-improvement-section",
      summary: "Cải thiện storefront bằng một section chuyển đổi rõ ràng hơn.",
      jsx: `<section className="agent-storefront-improvement-section mx-6 my-12 rounded-[2rem] bg-slate-100 px-6 py-10"><p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Trải nghiệm mua sắm</p><h2 className="mt-3 text-3xl font-semibold text-slate-950">Giao diện rõ ràng hơn, CTA nổi bật hơn</h2><p className="mt-3 max-w-2xl text-slate-600">Bổ sung điểm nhấn giúp khách hàng hiểu giá trị sản phẩm và tiếp tục hành trình mua hàng dễ dàng hơn.</p><a className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 font-semibold text-white" href="/products">Khám phá ngay</a></section>`,
    }) ?? buildProductGridPatch(fileMap, "visual");
    if (operation) operations.push(operation);
  }

  if (operations.length === 0) return patch;

  return {
    ...patch,
    summary: patch.summary || args.plan.summary,
    operations,
    changedFiles: operations.map((operation) => operation.path),
    projectStatePatch: buildFeaturePatch(args.projectState, prompt),
  };
}

function buildHomepageSectionPatch(fileMap: Map<string, string>, section: { marker: string; summary: string; jsx: string }): FileOperation | null {
  const path = findFirstPath(fileMap, [/^src\/routes\/index\.tsx$/, /home|index/i]);
  if (!path) return null;
  const content = fileMap.get(path) ?? "";
  if (!content || content.includes(section.marker)) return null;

  let nextContent = content;
  if (nextContent.includes("<TrustSignals />")) {
    nextContent = nextContent.replace("<TrustSignals />", `${section.jsx}<TrustSignals />`);
  } else if (nextContent.includes("</main>")) {
    nextContent = nextContent.replace("</main>", `${section.jsx}</main>`);
  } else {
    nextContent = `${nextContent}\n\n// ${section.summary}\n`;
  }

  return nextContent === content ? null : { type: "modify_file", path, content: nextContent };
}

function buildProductGridPatch(fileMap: Map<string, string>, mode: "responsive" | "visual"): FileOperation | null {
  const path = findFirstPath(fileMap, [/product-grid\.tsx$/i, /product.*grid/i]);
  if (!path) return null;
  const content = fileMap.get(path) ?? "";
  if (!content || content.includes("agent-responsive-grid")) return null;

  const improvedClass = mode === "responsive"
    ? "agent-responsive-grid grid gap-5 px-4 py-10 sm:px-6 md:grid-cols-2 lg:grid-cols-3 xl:gap-6"
    : "agent-responsive-grid grid gap-6 px-6 py-14 md:grid-cols-3";
  const nextContent = content
    .replace(/className="grid gap-4 px-6 py-12 md:grid-cols-3"/, `className="${improvedClass}"`)
    .replace(/className="grid gap-6 px-6 py-12"/, `className="${improvedClass}"`);

  if (nextContent !== content) return { type: "modify_file", path, content: nextContent };
  return { type: "modify_file", path, content: `${content}\n// agent-responsive-grid: improve responsive spacing and product discovery.\n` };
}

function buildProductCardPatch(fileMap: Map<string, string>, mode: "cta"): FileOperation | null {
  const path = findFirstPath(fileMap, [/product-card\.tsx$/i, /product.*card/i]);
  if (!path) return null;
  const content = fileMap.get(path) ?? "";
  if (!content || content.includes("agent-prominent-cta")) return null;

  const nextContent = content.replace(
    /className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-white"/,
    'className="agent-prominent-cta mt-5 w-full rounded-full bg-slate-950 px-5 py-3 text-center font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800"',
  );

  if (nextContent !== content) return { type: "modify_file", path, content: nextContent };
  return { type: "modify_file", path, content: `${content}\n// agent-prominent-cta: make purchase CTA more visible.\n` };
}

function findFirstPath(fileMap: Map<string, string>, patterns: RegExp[]) {
  return [...fileMap.keys()].find((path) => patterns.some((pattern) => pattern.test(path)));
}

function buildFeaturePatch(projectState: ProjectState, prompt: string): PatchResult["projectStatePatch"] {
  const features = { ...projectState.features };
  if (/feedback|testimonial|review|đánh giá|khách hàng|nhận xét/.test(prompt)) features.reviews = true;
  if (/sale|promotion|promo|khuyến mãi|giảm giá|ưu đãi|deal|banner/.test(prompt)) features.promotions = true;
  return { features };
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
