import type { OpenAIProvider } from "../openai/openai-provider.server";
import { CHANGE_PLAN_PROMPT, ECOMMERCE_AGENT_SYSTEM_PROMPT } from "../openai/prompts";
import { changePlanProviderSchema, changePlanSchema } from "../openai/schemas";
import type { BuilderIntent, ChangePlan, ProjectState } from "../project/project-state.schema";
import type { RetrievedFile } from "../source/retrieve-context.server";

const changeTypes = ["init_source", "create_files", "modify_files", "delete_files", "update_state_only", "explain_only"] as const;
const operationTypes = ["create_file", "modify_file", "delete_file", "update_project_state", "run_validation"] as const;
const riskLevels = ["low", "medium", "high"] as const;

export async function createChangePlan(args: {
  prompt: string;
  projectState: ProjectState;
  intent: BuilderIntent;
  relevantFiles: RetrievedFile[];
  provider?: OpenAIProvider;
  model?: string;
}): Promise<ChangePlan> {
  if (args.provider && args.model) {
    const rawPlan = await args.provider.parseStructured({
      model: args.model,
      system: `${ECOMMERCE_AGENT_SYSTEM_PROMPT}\n${CHANGE_PLAN_PROMPT}`,
      user: {
        prompt: args.prompt,
        projectState: args.projectState,
        intent: args.intent,
        relevantFiles: args.relevantFiles.map((file) => ({ path: file.path, reason: file.reason, tokenEstimate: file.tokenEstimate })),
      },
      schemaName: "change_plan",
      schema: changePlanProviderSchema,
    });
    return normalizeChangePlan(rawPlan, args);
  }

  return deterministicChangePlan(args);
}

export function normalizeChangePlan(rawPlan: unknown, args: {
  prompt: string;
  projectState: ProjectState;
  intent: BuilderIntent;
  relevantFiles: RetrievedFile[];
}): ChangePlan {
  if (!isRecord(rawPlan)) {
    throw new Error("CHANGE_PLAN_SCHEMA_INVALID: provider output must be an object.");
  }

  const affectedFiles = asStringArray(rawPlan.affectedFiles, args.relevantFiles.map((file) => file.path));
  const fallbackOperationType = affectedFiles.length > 0 ? "modify_file" : "update_project_state";
  const operations = normalizeOperations(rawPlan.operations, affectedFiles, fallbackOperationType);
  const plan: ChangePlan = {
    summary: asString(rawPlan.summary, asString(rawPlan.description, `Apply incremental ${args.intent.intent} update.`)),
    changeType: normalizeChangeType(rawPlan.changeType, args.intent, affectedFiles),
    affectedFiles,
    operations,
    acceptanceCriteria: asStringArray(rawPlan.acceptanceCriteria, ["Project state reflects the request."]),
    validationCommands: asStringArray(rawPlan.validationCommands, []),
    riskLevel: normalizeRiskLevel(rawPlan.riskLevel, args.intent.riskLevel),
    requiresUserConfirmation: typeof rawPlan.requiresUserConfirmation === "boolean"
      ? rawPlan.requiresUserConfirmation
      : args.intent.riskLevel === "high",
  };

  const result = changePlanSchema.safeParse(plan);
  if (!result.success) {
    const summary = result.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
    throw new Error(`CHANGE_PLAN_SCHEMA_INVALID: ${summary}`);
  }

  const normalizedResult: ChangePlan = {
    ...result.data,
    operations: result.data.operations.map((operation) => ({
      type: operation.type,
      reason: operation.reason,
      ...(operation.path ? { path: operation.path } : {}),
    })),
  };
  console.info(JSON.stringify({
    event: "change_plan_normalized",
    changeType: normalizedResult.changeType,
    affectedFileCount: normalizedResult.affectedFiles.length,
    operationCount: normalizedResult.operations.length,
    riskLevel: normalizedResult.riskLevel,
  }));
  return normalizedResult;
}

function deterministicChangePlan(args: {
  prompt: string;
  projectState: ProjectState;
  intent: BuilderIntent;
  relevantFiles: RetrievedFile[];
}): ChangePlan {
  if (args.intent.ecommerceMeaning.affectedFeatures.includes("productFilter") || /filter|lọc|size|color|price/i.test(args.prompt)) {
    return {
      summary: "Add product filters for size, color, and price on the products experience.",
      changeType: "modify_files",
      affectedFiles: ["src/components/store/product-filter.tsx", "src/lib/product-filter.ts", "src/components/store/product-grid.tsx", "src/data/products.ts"],
      operations: [
        { type: "create_file", path: "src/components/store/product-filter.tsx", reason: "Render product filter controls." },
        { type: "create_file", path: "src/lib/product-filter.ts", reason: "Filter product data by selected facets." },
        { type: "modify_file", path: "src/components/store/product-grid.tsx", reason: "Use filter controls with the product grid." },
        { type: "update_project_state", reason: "Mark product filtering as enabled." },
        { type: "run_validation", reason: "Validate generated storefront after patch." },
      ],
      acceptanceCriteria: ["Products can be filtered by size, color, and price.", "Existing cart and checkout files are preserved."],
      validationCommands: [],
      riskLevel: "low",
      requiresUserConfirmation: false,
    };
  }
  return {
    summary: `Apply incremental ${args.intent.intent} update.`,
    changeType: "update_state_only",
    affectedFiles: args.relevantFiles.map((file) => file.path),
    operations: [{ type: "update_project_state", reason: "Record interpreted requirement." }],
    acceptanceCriteria: ["Project state reflects the request."],
    validationCommands: [],
    riskLevel: args.intent.riskLevel,
    requiresUserConfirmation: args.intent.riskLevel === "high",
  };
}

function normalizeOperations(rawOperations: unknown, affectedFiles: string[], fallbackType: ChangePlan["operations"][number]["type"]): ChangePlan["operations"] {
  const operations = Array.isArray(rawOperations)
    ? rawOperations.flatMap((operation) => normalizeOperation(operation))
    : [];
  if (operations.length > 0) return operations;
  if (affectedFiles.length > 0) {
    return affectedFiles.map((path) => ({ type: fallbackType, path, reason: "Apply requested storefront change." }));
  }
  return [{ type: "update_project_state", reason: "Record interpreted requirement." }];
}

function normalizeOperation(operation: unknown): ChangePlan["operations"] {
  if (!isRecord(operation)) return [];
  const type = includes(operationTypes, operation.type) ? operation.type : undefined;
  if (!type) return [];
  return [{
    type,
    path: typeof operation.path === "string" ? operation.path : undefined,
    reason: asString(operation.reason, "Apply requested storefront change."),
  }];
}

function normalizeChangeType(value: unknown, intent: BuilderIntent, affectedFiles: string[]): ChangePlan["changeType"] {
  if (includes(changeTypes, value)) return value;
  if (intent.intent === "init_project") return "init_source";
  if (intent.intent === "explain_project") return "explain_only";
  return affectedFiles.length > 0 ? "modify_files" : "update_state_only";
}

function normalizeRiskLevel(value: unknown, fallback: BuilderIntent["riskLevel"]): ChangePlan["riskLevel"] {
  return includes(riskLevels, value) ? value : fallback;
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const strings = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return strings.length > 0 ? strings : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function includes<const T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}
