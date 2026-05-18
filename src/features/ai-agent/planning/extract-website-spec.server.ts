import type { OpenAIProvider } from "../openai/openai-provider.server";
import { ECOMMERCE_AGENT_SYSTEM_PROMPT } from "../openai/prompts";
import { websiteSpecProviderSchema } from "../openai/schemas";
import type { WebsiteSpec } from "../project/project-state.schema";
import { AgentError } from "../agent/agent-errors";

const WEBSITE_SPEC_CONTRACT_PROMPT = `Extract a complete ecommerce WebsiteSpec from the user prompt.
Return exactly one compact JSON object matching this contract.
Allowed top-level keys only: store, brand, pages, products, features, content.
Do not include projectId, fileManifest, decisionLog, recentChanges, routes, sourceCode, generatedFiles, surface, textPrimary, textSecondary, or any other extra top-level keys.
brand.colors may only include primary, secondary, accent, background, foreground.
Use null for unavailable nullable fields. Prefer English storefront copy unless the user asks for another language.
Limits: max 4 pages, max 6 products, concise strings.
Example shape: {"store":{"name":"Demo Store","type":"fashion","description":"Modern ecommerce store","targetCustomers":["shoppers"]},"brand":{"name":"Demo Store","tagline":null,"tone":"friendly","colors":{"primary":"#111827","secondary":null,"accent":"#3B82F6","background":"#FFFFFF","foreground":"#111827"},"typography":null,"visualStyle":null},"pages":[{"path":"/","name":"Home","sections":["Hero","Products"]}],"products":[{"id":"prod-1","name":"Featured Product","category":null,"price":99,"compareAtPrice":null,"description":"Featured item","imagePrompt":null,"attributes":null}],"features":{"productListing":true,"productDetail":true,"cart":true,"cartDrawer":false,"checkout":true,"productSearch":false,"productFilter":false,"wishlist":false,"reviews":false,"promotions":false,"newsletter":false,"auth":false,"adminDashboard":false,"paymentIntegration":"mock"},"content":{"heroTitle":"Shop new arrivals","heroSubtitle":"A modern shopping experience","primaryCta":"Shop now","secondaryCta":null,"trustSignals":["Mock checkout"],"faq":[]}}`;

export async function extractWebsiteSpec(input: { prompt: string; provider?: OpenAIProvider; model?: string; projectState?: unknown }): Promise<WebsiteSpec> {
  const fallback = createFallbackWebsiteSpec(input.prompt);
  if (input.provider && input.model) {
    try {
      const spec = await parseProviderWebsiteSpec({
        prompt: input.prompt,
        projectState: input.projectState,
        provider: input.provider,
        model: input.model,
      });
      const normalized = normalizeWebsiteSpec(spec, fallback);
      assertNormalizedWebsiteSpec(normalized);
      return normalized;
    } catch (error) {
      console.warn(JSON.stringify({
        event: "extract_website_spec_provider_failed_using_heuristic_fallback",
        model: input.model,
        error: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400),
      }));
      assertNormalizedWebsiteSpec(fallback);
      return fallback;
    }
  }

  assertNormalizedWebsiteSpec(fallback);
  return fallback;
}

async function parseProviderWebsiteSpec(input: { prompt: string; provider: OpenAIProvider; model: string; projectState?: unknown }) {
  try {
    const firstSpec = await callWebsiteSpecProvider(input, WEBSITE_SPEC_CONTRACT_PROMPT);
    const firstValidation = validateProviderWebsiteSpecShape(firstSpec);
    if (firstValidation.ok) return firstSpec;

    return retryProviderWebsiteSpec(input, firstValidation.errors, {
      missingKeys: firstValidation.missingKeys,
      extraKeys: firstValidation.extraKeys,
    });
  } catch (error) {
    if (error instanceof AgentError) throw error;
    return retryProviderWebsiteSpec(input, [error instanceof Error ? error.message : "provider output was not valid JSON"], {
      missingKeys: [],
      extraKeys: [],
    });
  }
}

async function retryProviderWebsiteSpec(
  input: { prompt: string; provider: OpenAIProvider; model: string; projectState?: unknown },
  errors: string[],
  metadata: { missingKeys: string[]; extraKeys: string[] },
) {
  console.info(JSON.stringify({
    event: "website_spec_provider_shape_retry",
    missingKeys: metadata.missingKeys,
    extraKeys: metadata.extraKeys,
  }));

  let retrySpec: unknown;
  try {
    retrySpec = await callWebsiteSpecProvider(
      input,
      `${WEBSITE_SPEC_CONTRACT_PROMPT}
Your previous output did not match the required WebsiteSpec contract. Fix these shape errors: ${errors.join("; ")}. Return only the corrected WebsiteSpec JSON object.`,
    );
  } catch (error) {
    throw new AgentError(
      "INVALID_WEBSITE_SPEC_PROVIDER_OUTPUT",
      `AI provider returned invalid WebsiteSpec JSON: ${error instanceof Error ? error.message : "unknown parse error"}`,
    );
  }

  const retryValidation = validateProviderWebsiteSpecShape(retrySpec);
  if (retryValidation.ok) return retrySpec;

  throw new AgentError(
    "INVALID_WEBSITE_SPEC_PROVIDER_OUTPUT",
    `AI provider returned invalid WebsiteSpec structure: ${retryValidation.errors.join("; ")}`,
  );
}

function callWebsiteSpecProvider(input: { prompt: string; provider: OpenAIProvider; model: string; projectState?: unknown }, contractPrompt: string) {
  return input.provider.parseStructured({
    model: input.model,
    system: `${ECOMMERCE_AGENT_SYSTEM_PROMPT}
${contractPrompt}`,
    user: { prompt: input.prompt, projectState: input.projectState },
    schemaName: "website_spec",
    schema: websiteSpecProviderSchema,
    allowFreeFormFallback: true,
  });
}

export function validateProviderWebsiteSpecShape(rawSpec: unknown): { ok: boolean; missingKeys: string[]; extraKeys: string[]; errors: string[] } {
  const spec = unwrapWebsiteSpec(rawSpec);
  const requiredKeys = ["store", "brand", "pages", "products", "features", "content"];
  if (!isRecord(spec)) {
    return { ok: false, missingKeys: requiredKeys, extraKeys: [], errors: ["root must be an object"] };
  }
  const keys = Object.keys(spec);
  const missingKeys = requiredKeys.filter((key) => !(key in spec));
  const extraKeys = keys.filter((key) => !requiredKeys.includes(key));
  const errors = [
    ...missingKeys.map((key) => `missing top-level key ${key}`),
    ...extraKeys.map((key) => `extra top-level key ${key}`),
  ];
  return { ok: errors.length === 0, missingKeys, extraKeys, errors };
}

export function normalizeWebsiteSpec(rawSpec: unknown, fallback: WebsiteSpec): WebsiteSpec {
  const unwrappedSpec = unwrapWebsiteSpec(rawSpec);
  if (!isRecord(unwrappedSpec)) return fallback;

  const rawStore = isRecord(unwrappedSpec.store) ? unwrappedSpec.store : {};
  const rawBrand = isRecord(unwrappedSpec.brand) ? unwrappedSpec.brand : {};
  const rawColors = isRecord(rawBrand.colors) ? rawBrand.colors : {};
  const rawTypography = isRecord(rawBrand.typography) ? rawBrand.typography : undefined;
  const rawContent = isRecord(unwrappedSpec.content) ? unwrappedSpec.content : {};

  const fallbackPage = fallback.pages[0] ?? { path: "/", name: "Home", sections: ["Hero"] };
  const fallbackProduct = fallback.products[0] ?? { id: "prod-1", name: "Featured Product", price: 99 };
  const fallbackFaq = fallback.content.faq[0] ?? { question: "Is checkout live?", answer: "Checkout is mocked until payment credentials are configured." };

  const pages = asArray(unwrappedSpec.pages, fallback.pages)
    .map((page, index) => normalizePage(page, fallback.pages[index] ?? fallbackPage))
    .filter(Boolean) as WebsiteSpec["pages"];

  const products = asArray(unwrappedSpec.products, fallback.products)
    .map((product, index) => normalizeProduct(product, fallback.products[index] ?? fallbackProduct))
    .filter(Boolean) as WebsiteSpec["products"];

  const faq = asArray(rawContent.faq, fallback.content.faq)
    .map((item, index) => normalizeFaq(item, fallback.content.faq[index] ?? fallbackFaq))
    .filter(Boolean) as WebsiteSpec["content"]["faq"];

  return {
    store: {
      name: asString(rawStore.name, fallback.store.name),
      type: asStoreType(rawStore.type, fallback.store.type),
      description: asString(rawStore.description, fallback.store.description),
      targetCustomers: asStringArray(rawStore.targetCustomers, fallback.store.targetCustomers),
    },
    brand: {
      name: asString(rawBrand.name, fallback.brand.name),
      tagline: nullableToUndefinedString(rawBrand.tagline),
      tone: asBrandTone(rawBrand.tone, fallback.brand.tone),
      colors: {
        primary: asString(rawColors.primary, fallback.brand.colors.primary),
        secondary: nullableToUndefinedString(rawColors.secondary) ?? fallback.brand.colors.secondary,
        accent: nullableToUndefinedString(rawColors.accent) ?? fallback.brand.colors.accent,
        background: nullableToUndefinedString(rawColors.background) ?? fallback.brand.colors.background,
        foreground: nullableToUndefinedString(rawColors.foreground) ?? fallback.brand.colors.foreground,
      },
      typography: rawTypography
        ? {
            heading: nullableToUndefinedString(rawTypography.heading),
            body: nullableToUndefinedString(rawTypography.body),
          }
        : fallback.brand.typography,
      visualStyle: nullableToUndefinedString(rawBrand.visualStyle) ?? fallback.brand.visualStyle,
    },
    pages: pages.length > 0 ? pages : [fallbackPage],
    products: products.length > 0 ? products : [fallbackProduct],
    features: isRecord(unwrappedSpec.features) ? { ...fallback.features, ...unwrappedSpec.features } as WebsiteSpec["features"] : fallback.features,
    content: {
      heroTitle: asString(rawContent.heroTitle, fallback.content.heroTitle),
      heroSubtitle: asString(rawContent.heroSubtitle, fallback.content.heroSubtitle),
      primaryCta: asString(rawContent.primaryCta, fallback.content.primaryCta),
      secondaryCta: nullableToUndefinedString(rawContent.secondaryCta) ?? fallback.content.secondaryCta,
      trustSignals: asStringArray(rawContent.trustSignals, fallback.content.trustSignals),
      faq: faq.length > 0 ? faq : [fallbackFaq],
    },
  };
}

export function assertNormalizedWebsiteSpec(spec: WebsiteSpec): asserts spec is WebsiteSpec {
  if (!isRecord(spec.store) || !asString(spec.store.name, "")) {
    throw new AgentError("INVALID_WEBSITE_SPEC", "Website spec is missing a valid store name.");
  }
  if (!isRecord(spec.brand) || !asString(spec.brand.name, "")) {
    throw new AgentError("INVALID_WEBSITE_SPEC", "Website spec is missing a valid brand name.");
  }
  if (!Array.isArray(spec.store.targetCustomers)) {
    throw new AgentError("INVALID_WEBSITE_SPEC", "Website spec store.targetCustomers must be an array.");
  }
  if (!Array.isArray(spec.pages)) {
    throw new AgentError("INVALID_WEBSITE_SPEC", "Website spec pages must be an array.");
  }
  if (!Array.isArray(spec.products)) {
    throw new AgentError("INVALID_WEBSITE_SPEC", "Website spec products must be an array.");
  }
  if (!isRecord(spec.features)) {
    throw new AgentError("INVALID_WEBSITE_SPEC", "Website spec features must be an object.");
  }
  if (!Array.isArray(spec.content.trustSignals)) {
    throw new AgentError("INVALID_WEBSITE_SPEC", "Website spec content.trustSignals must be an array.");
  }
  if (!Array.isArray(spec.content.faq)) {
    throw new AgentError("INVALID_WEBSITE_SPEC", "Website spec content.faq must be an array.");
  }
}

function unwrapWebsiteSpec(rawSpec: unknown) {
  if (!isRecord(rawSpec)) return rawSpec;
  if (isRecord(rawSpec.websiteSpec)) return rawSpec.websiteSpec;
  if (isRecord(rawSpec.website_spec)) return rawSpec.website_spec;
  if (isRecord(rawSpec.data)) return rawSpec.data;
  if (isRecord(rawSpec.project)) return rawSpec.project;
  if (isRecord(rawSpec.storefront)) return rawSpec.storefront;
  if (isRecord(rawSpec.spec)) return rawSpec.spec;
  return rawSpec;
}

function createFallbackWebsiteSpec(prompt: string): WebsiteSpec {
  const lower = prompt.toLowerCase();
  const type = lower.includes("cosmetic") || lower.includes("beauty")
    ? "cosmetics"
    : lower.includes("electronic") || lower.includes("tech")
      ? "electronics"
      : lower.includes("single")
        ? "single-product"
        : lower.includes("sneaker") || lower.includes("fashion") || lower.includes("streetwear")
          ? "fashion"
          : "general";
  const tone = lower.includes("streetwear") ? "streetwear" : lower.includes("luxury") ? "luxury" : "friendly";
  const name = lower.includes("sneaker") ? "Sneaker Lab" : "AI Storefront";
  return {
    store: { name, type, description: prompt, targetCustomers: type === "fashion" ? ["Style-conscious shoppers"] : [] },
    brand: { name, tone, colors: { primary: "#111827", accent: "#f59e0b", background: "#ffffff", foreground: "#111827" } },
    pages: [
      { path: "/", name: "Home", sections: ["Hero", "Featured products", "Trust signals"] },
      { path: "/products", name: "Products", sections: ["Product grid", "Categories"] },
      { path: "/cart", name: "Cart", sections: ["Cart items", "Subtotal"] },
      { path: "/checkout", name: "Checkout", sections: ["Mock checkout"] },
    ],
    products: [
      { id: "prod-1", name: type === "fashion" ? "Street Runner Sneaker" : "Signature Product", price: 129, compareAtPrice: 159, description: "A customer favorite built for everyday conversion." },
      { id: "prod-2", name: type === "fashion" ? "Court Classic Sneaker" : "Essential Product", price: 99, description: "A reliable choice for first-time buyers." },
    ],
    features: { productListing: true, productDetail: true, cart: true, checkout: true, paymentIntegration: "mock" },
    content: {
      heroTitle: type === "fashion" ? "Fresh drops for every street" : "Launch your storefront with confidence",
      heroSubtitle: "A fast, conversion-focused shopping experience generated from your prompt.",
      primaryCta: "Shop now",
      secondaryCta: "View products",
      trustSignals: ["Secure mock checkout", "Fast responsive storefront", "Curated products"],
      faq: [{ question: "Is checkout live?", answer: "This starter uses a safe mock checkout until real payment credentials are configured." }],
    },
  };
}

function normalizePage(rawPage: unknown, fallback: WebsiteSpec["pages"][number]) {
  if (!isRecord(rawPage)) return fallback;
  return {
    path: asString(rawPage.path, fallback.path),
    name: asString(rawPage.name, fallback.name),
    sections: asStringArray(rawPage.sections, fallback.sections),
  };
}

function normalizeProduct(rawProduct: unknown, fallback: WebsiteSpec["products"][number]) {
  if (!isRecord(rawProduct)) return fallback;
  return {
    id: asString(rawProduct.id, fallback.id),
    name: asString(rawProduct.name, fallback.name),
    category: nullableToUndefinedString(rawProduct.category) ?? fallback.category,
    price: asOptionalNumber(rawProduct.price, fallback.price),
    compareAtPrice: asOptionalNumber(rawProduct.compareAtPrice, fallback.compareAtPrice),
    description: nullableToUndefinedString(rawProduct.description) ?? fallback.description,
    imagePrompt: nullableToUndefinedString(rawProduct.imagePrompt) ?? fallback.imagePrompt,
    attributes: isRecord(rawProduct.attributes) ? rawProduct.attributes as Record<string, string | number | boolean> : fallback.attributes,
  };
}

function normalizeFaq(rawFaq: unknown, fallback: WebsiteSpec["content"]["faq"][number]) {
  if (!isRecord(rawFaq)) return fallback;
  return {
    question: asString(rawFaq.question, fallback.question),
    answer: asString(rawFaq.answer, fallback.answer),
  };
}

function asArray<T>(value: unknown, fallback: T[]): unknown[] {
  if (Array.isArray(value)) return value;
  return Array.isArray(fallback) ? fallback : [];
}

function asStringArray(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return Array.isArray(fallback) ? fallback : [];
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function nullableToUndefinedString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asOptionalNumber(value: unknown, fallback?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStoreType(value: unknown, fallback: WebsiteSpec["store"]["type"]): WebsiteSpec["store"]["type"] {
  return ["fashion", "cosmetics", "electronics", "furniture", "food", "single-product", "general"].includes(String(value))
    ? value as WebsiteSpec["store"]["type"]
    : fallback;
}

function asBrandTone(value: unknown, fallback: WebsiteSpec["brand"]["tone"]): WebsiteSpec["brand"]["tone"] {
  return ["minimal", "premium", "luxury", "friendly", "playful", "bold", "streetwear", "organic", "tech"].includes(String(value))
    ? value as WebsiteSpec["brand"]["tone"]
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
