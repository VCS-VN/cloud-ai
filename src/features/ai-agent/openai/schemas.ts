import { z } from "zod";

const paymentIntegrationValues = ["none", "mock", "cod", "stripe", "paypal"] as const;
const featureKeys = [
  "productListing",
  "productDetail",
  "cart",
  "cartDrawer",
  "checkout",
  "productSearch",
  "productFilter",
  "wishlist",
  "reviews",
  "promotions",
  "newsletter",
  "auth",
  "adminDashboard",
  "paymentIntegration",
] as const;

export const builderIntentSchema = z.object({
  intent: z.enum([
    "init_project",
    "add_feature",
    "modify_design",
    "modify_content",
    "modify_products",
    "fix_bug",
    "integrate_service",
    "explain_project",
    "rebuild_project",
    "unknown",
  ]),
  confidence: z.number().min(0).max(1),
  userGoal: z.string(),
  normalizedRequirement: z.string(),
  ecommerceMeaning: z.object({
    affectedPages: z.array(z.string()),
    affectedFeatures: z.array(z.string()),
    affectedDataModels: z.array(z.string()),
    businessImpact: z.string(),
  }),
  shouldAskClarifyingQuestion: z.boolean(),
  clarificationQuestion: z.string().nullable(),
  riskLevel: z.enum(["low", "medium", "high"]),
});

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  price: z.number().nullable(),
  compareAtPrice: z.number().nullable(),
  description: z.string().nullable(),
  imagePrompt: z.string().nullable(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).nullable(),
});

export const brandSchema = z.object({
  name: z.string(),
  tagline: z.string().nullable(),
  tone: z.enum(["minimal", "premium", "luxury", "friendly", "playful", "bold", "streetwear", "organic", "tech"]),
  colors: z.object({
    primary: z.string(),
    secondary: z.string().nullable(),
    accent: z.string().nullable(),
    background: z.string().nullable(),
    foreground: z.string().nullable(),
  }),
  typography: z.object({ heading: z.string().nullable(), body: z.string().nullable() }).nullable(),
  visualStyle: z.string().nullable(),
});

export const websiteSpecSchema = z.object({
  store: z.object({
    name: z.string(),
    type: z.enum(["fashion", "cosmetics", "electronics", "furniture", "food", "single-product", "general"]),
    description: z.string(),
    targetCustomers: z.array(z.string()),
  }),
  brand: brandSchema,
  pages: z.array(z.object({ path: z.string(), name: z.string(), sections: z.array(z.string()) })),
  products: z.array(productSchema),
  features: z.record(z.string(), z.union([z.boolean(), z.enum(["none", "mock", "cod", "stripe", "paypal"])])),
  content: z.object({
    heroTitle: z.string(),
    heroSubtitle: z.string(),
    primaryCta: z.string(),
    secondaryCta: z.string().nullable(),
    trustSignals: z.array(z.string()),
    faq: z.array(z.object({ question: z.string(), answer: z.string() })),
  }),
});

export const websiteSpecProviderSchema = strictObjectSchema(
  {
    store: strictObjectSchema(
      {
        name: { type: "string" },
        type: { type: "string", enum: ["fashion", "cosmetics", "electronics", "furniture", "food", "single-product", "general"] },
        description: { type: "string" },
        targetCustomers: { type: "array", items: { type: "string" } },
      },
      ["name", "type", "description", "targetCustomers"],
    ),
    brand: strictObjectSchema(
      {
        name: { type: "string" },
        tagline: nullableSchema({ type: "string" }),
        tone: { type: "string", enum: ["minimal", "premium", "luxury", "friendly", "playful", "bold", "streetwear", "organic", "tech"] },
        colors: strictObjectSchema(
          {
            primary: { type: "string" },
            secondary: nullableSchema({ type: "string" }),
            accent: nullableSchema({ type: "string" }),
            background: nullableSchema({ type: "string" }),
            foreground: nullableSchema({ type: "string" }),
          },
          ["primary", "secondary", "accent", "background", "foreground"],
        ),
        typography: nullableSchema(strictObjectSchema({ heading: nullableSchema({ type: "string" }), body: nullableSchema({ type: "string" }) }, ["heading", "body"])),
        visualStyle: nullableSchema({ type: "string" }),
      },
      ["name", "tagline", "tone", "colors", "typography", "visualStyle"],
    ),
    pages: {
      type: "array",
      items: strictObjectSchema({ path: { type: "string" }, name: { type: "string" }, sections: { type: "array", items: { type: "string" } } }, ["path", "name", "sections"]),
    },
    products: {
      type: "array",
      items: strictObjectSchema(
        {
          id: { type: "string" },
          name: { type: "string" },
          category: nullableSchema({ type: "string" }),
          price: nullableSchema({ type: "number" }),
          compareAtPrice: nullableSchema({ type: "number" }),
          description: nullableSchema({ type: "string" }),
          imagePrompt: nullableSchema({ type: "string" }),
          attributes: nullableSchema({ type: "object", additionalProperties: { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] } }),
        },
        ["id", "name", "category", "price", "compareAtPrice", "description", "imagePrompt", "attributes"],
      ),
    },
    features: strictObjectSchema(
      Object.fromEntries(featureKeys.map((key) => [key, key === "paymentIntegration" ? nullableSchema({ type: "string", enum: [...paymentIntegrationValues] }) : nullableSchema({ type: "boolean" })])),
      [...featureKeys],
    ),
    content: strictObjectSchema(
      {
        heroTitle: { type: "string" },
        heroSubtitle: { type: "string" },
        primaryCta: { type: "string" },
        secondaryCta: nullableSchema({ type: "string" }),
        trustSignals: { type: "array", items: { type: "string" } },
        faq: { type: "array", items: strictObjectSchema({ question: { type: "string" }, answer: { type: "string" } }, ["question", "answer"]) },
      },
      ["heroTitle", "heroSubtitle", "primaryCta", "secondaryCta", "trustSignals", "faq"],
    ),
  },
  ["store", "brand", "pages", "products", "features", "content"],
);

export const changePlanSchema = z.object({
  summary: z.string(),
  changeType: z.enum(["init_source", "create_files", "modify_files", "delete_files", "update_state_only", "explain_only"]),
  affectedFiles: z.array(z.string()),
  operations: z.array(z.object({
    type: z.enum(["create_file", "modify_file", "delete_file", "update_project_state", "run_validation"]),
    path: z.string().nullable().optional(),
    reason: z.string(),
  })),
  acceptanceCriteria: z.array(z.string()),
  validationCommands: z.array(z.string()),
  riskLevel: z.enum(["low", "medium", "high"]),
  requiresUserConfirmation: z.boolean(),
});


export const changePlanProviderSchema = strictObjectSchema(
  {
    summary: { type: "string" },
    changeType: { type: "string", enum: ["init_source", "create_files", "modify_files", "delete_files", "update_state_only", "explain_only"] },
    affectedFiles: { type: "array", items: { type: "string" } },
    operations: {
      type: "array",
      items: strictObjectSchema(
        {
          type: { type: "string", enum: ["create_file", "modify_file", "delete_file", "update_project_state", "run_validation"] },
          path: nullableSchema({ type: "string" }),
          reason: { type: "string" },
        },
        ["type", "path", "reason"],
      ),
    },
    acceptanceCriteria: { type: "array", items: { type: "string" } },
    validationCommands: { type: "array", items: { type: "string" } },
    riskLevel: { type: "string", enum: ["low", "medium", "high"] },
    requiresUserConfirmation: { type: "boolean" },
  },
  ["summary", "changeType", "affectedFiles", "operations", "acceptanceCriteria", "validationCommands", "riskLevel", "requiresUserConfirmation"],
);

export const fileOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create_file"), path: z.string(), content: z.string() }),
  z.object({ type: z.literal("modify_file"), path: z.string(), content: z.string() }),
  z.object({ type: z.literal("delete_file"), path: z.string() }),
]);

export const patchResultSchema = z.object({
  summary: z.string(),
  operations: z.array(fileOperationSchema),
  changedFiles: z.array(z.string()),
  projectStatePatch: z.object({
    features: z.object({
      productListing: z.boolean().nullable(),
      productDetail: z.boolean().nullable(),
      cart: z.boolean().nullable(),
      cartDrawer: z.boolean().nullable(),
      checkout: z.boolean().nullable(),
      productSearch: z.boolean().nullable(),
      productFilter: z.boolean().nullable(),
      wishlist: z.boolean().nullable(),
      reviews: z.boolean().nullable(),
      promotions: z.boolean().nullable(),
      newsletter: z.boolean().nullable(),
      auth: z.boolean().nullable(),
      adminDashboard: z.boolean().nullable(),
      paymentIntegration: z.enum(["none", "mock", "cod", "stripe", "paypal"]).nullable(),
    }).nullable(),
  }).nullable(),
});


const patchFileOperationProviderSchema = {
  anyOf: [
    strictObjectSchema({ type: { type: "string", enum: ["create_file"] }, path: { type: "string" }, content: { type: "string" } }, ["type", "path", "content"]),
    strictObjectSchema({ type: { type: "string", enum: ["modify_file"] }, path: { type: "string" }, content: { type: "string" } }, ["type", "path", "content"]),
    strictObjectSchema({ type: { type: "string", enum: ["delete_file"] }, path: { type: "string" } }, ["type", "path"]),
  ],
};

export const patchResultProviderSchema = strictObjectSchema(
  {
    summary: { type: "string" },
    operations: { type: "array", items: patchFileOperationProviderSchema },
    changedFiles: { type: "array", items: { type: "string" } },
    projectStatePatch: nullableSchema(strictObjectSchema(
      {
        features: nullableSchema(strictObjectSchema(
          {
        productListing: nullableSchema({ type: "boolean" }),
        productDetail: nullableSchema({ type: "boolean" }),
        cart: nullableSchema({ type: "boolean" }),
        cartDrawer: nullableSchema({ type: "boolean" }),
        checkout: nullableSchema({ type: "boolean" }),
        productSearch: nullableSchema({ type: "boolean" }),
        productFilter: nullableSchema({ type: "boolean" }),
        wishlist: nullableSchema({ type: "boolean" }),
        reviews: nullableSchema({ type: "boolean" }),
        promotions: nullableSchema({ type: "boolean" }),
        newsletter: nullableSchema({ type: "boolean" }),
        auth: nullableSchema({ type: "boolean" }),
        adminDashboard: nullableSchema({ type: "boolean" }),
        paymentIntegration: nullableSchema({ type: "string", enum: ["none", "mock", "cod", "stripe", "paypal"] }),
      },
          [...featureKeys],
        )),
      },
      ["features"],
    )),
  },
  ["summary", "operations", "changedFiles", "projectStatePatch"],
);

function strictObjectSchema(properties: Record<string, unknown>, required: readonly string[]) {
  return { type: "object", additionalProperties: false, properties, required: [...required] };
}

function nullableSchema(schema: Record<string, unknown>) {
  return { anyOf: [schema, { type: "null" }] };
}
