import { z } from "zod";
import type { ProjectState } from "../project/project-state.schema";

const nonEmptyString = z.string().trim().min(1);
const confidenceSchema = z.number().min(0).max(1);

export const wishTypeSchema = z.enum(["explicit", "implicit", "inferred"]);
export const prioritySchema = z.enum(["must_have", "should_have", "nice_to_have"]);
export const riskLevelSchema = z.enum(["low", "medium", "high"]);

export const lifecycleIntentSchema = z.enum([
  "init_project",
  "update_project",
  "modify_design",
  "modify_content",
  "modify_products",
  "add_feature",
  "fix_bug",
  "explain_project",
  "unknown",
]);

export const agentTaskTypeSchema = z.enum([
  "init_storefront_project",
  "incremental_source_update",
  "content_update",
  "design_update",
  "product_data_update",
  "bug_fix",
  "answer_question",
  "needs_clarification",
]);

export const ecommercePrimaryGoalSchema = z.enum([
  "conversion",
  "product_discovery",
  "trust_building",
  "brand_positioning",
  "checkout_improvement",
  "content_update",
  "technical_fix",
  "project_initialization",
]);

export const projectContextStatusSchema = z.enum(["empty", "initialized", "building", "ready", "error"]);
export const fileManifestKindSchema = z.enum(["route", "component", "state", "style", "config", "data", "server", "unknown"]);
export const validationStatusSchema = z.enum(["passed", "failed", "skipped"]);
export const previewStatusSchema = z.enum(["stopped", "starting", "running", "failed"]);

export const thinkingInputSchema = z.object({
  projectId: nonEmptyString,
  runId: nonEmptyString,
  userId: z.string().optional(),
  userPrompt: nonEmptyString,
  projectState: z.custom<ProjectState>().nullable(),
  conversationContext: z.object({
    recentUserMessages: z.array(z.object({ id: nonEmptyString, content: z.string(), createdAt: nonEmptyString })),
    recentAssistantSummaries: z.array(z.object({ runId: nonEmptyString, summary: z.string(), createdAt: nonEmptyString })),
  }),
  projectContext: z.object({
    status: projectContextStatusSchema,
    fileManifest: z.array(z.object({ path: nonEmptyString, purpose: z.string(), kind: fileManifestKindSchema })),
    recentChanges: z.array(z.object({
      runId: nonEmptyString,
      userPrompt: z.string(),
      summary: z.string(),
      changedFiles: z.array(z.string()),
      validationStatus: validationStatusSchema,
    })),
    previewStatus: z.object({
      status: previewStatusSchema,
      previewUrl: z.string().optional(),
      lastError: z.string().optional(),
    }).optional(),
  }),
});

export const preflightResultSchema = z.object({
  sanitizedPrompt: z.string(),
  warnings: z.array(z.string()),
  blocked: z.boolean(),
  blockReason: z.string().optional(),
}).superRefine((value, context) => {
  if (value.blocked && !value.blockReason?.trim()) {
    context.addIssue({ code: "custom", path: ["blockReason"], message: "blockReason is required when blocked is true" });
  }
});

export const promptClassificationSchema = z.object({
  lifecycleIntent: lifecycleIntentSchema,
  confidence: confidenceSchema,
  reasonSummary: nonEmptyString,
});

export const extractedWishSchema = z.object({
  id: nonEmptyString,
  type: wishTypeSchema,
  description: nonEmptyString,
  priority: prioritySchema,
  confidence: confidenceSchema,
  evidence: z.string(),
});

export const ecommerceInterpretationSchema = z.object({
  primaryGoal: ecommercePrimaryGoalSchema,
  affectedPages: z.array(z.string()),
  affectedSections: z.array(z.string()),
  affectedFeatures: z.array(z.string()),
  affectedDataModels: z.array(z.string()),
  expectedBusinessImpact: nonEmptyString,
});

export const thinkingConstraintsSchema = z.object({
  explicitConstraints: z.array(z.string()),
  inferredConstraints: z.array(z.string()),
  doNotChange: z.array(z.string()),
  styleConstraints: z.array(z.string()),
  technicalConstraints: z.array(z.string()),
});

export const assumptionSchema = z.object({
  id: nonEmptyString,
  description: nonEmptyString,
  reason: nonEmptyString,
  risk: riskLevelSchema,
});

export const ambiguitySchema = z.object({
  id: nonEmptyString,
  question: nonEmptyString,
  impact: riskLevelSchema,
  recommendedHandling: z.enum(["use_default", "ask_user", "require_confirmation", "block"]),
  defaultResolution: z.string().optional(),
}).superRefine((value, context) => {
  if (value.recommendedHandling === "use_default" && !value.defaultResolution?.trim()) {
    context.addIssue({ code: "custom", path: ["defaultResolution"], message: "defaultResolution is required for use_default handling" });
  }
});

export const conflictSchema = z.object({
  id: nonEmptyString,
  description: nonEmptyString,
  conflictWith: z.enum(["project_state", "recent_change", "tech_stack", "security_policy", "ecommerce_rule"]),
  severity: riskLevelSchema,
  resolution: z.enum(["override", "preserve_existing", "ask_user", "block"]),
});

export const riskAssessmentSchema = z.object({
  level: riskLevelSchema,
  reasons: z.array(z.string()),
  requiresUserConfirmation: z.boolean(),
});

export const agentTaskRequirementSchema = z.object({
  id: nonEmptyString,
  description: nonEmptyString,
  sourceWishId: nonEmptyString,
  priority: prioritySchema,
  acceptanceCriteria: z.array(nonEmptyString).min(1),
});

export const targetScopeSchema = z.object({
  pages: z.array(z.string()),
  sections: z.array(z.string()),
  features: z.array(z.string()),
  filesHint: z.array(z.string()),
  dataModels: z.array(z.string()),
});

export const executionPolicySchema = z.object({
  allowInitSource: z.boolean(),
  allowPatchSource: z.boolean(),
  allowPackageChange: z.boolean(),
  allowConfigChange: z.boolean(),
  allowPreviewRestart: z.boolean(),
  requireHumanConfirmation: z.boolean(),
});

export const agentTaskSchema = z.object({
  taskId: nonEmptyString,
  projectId: nonEmptyString,
  runId: nonEmptyString,
  taskType: agentTaskTypeSchema,
  normalizedGoal: nonEmptyString,
  userPrompt: nonEmptyString,
  requirements: z.array(agentTaskRequirementSchema),
  targetScope: targetScopeSchema,
  executionPolicy: executionPolicySchema,
  clarification: z.object({
    required: z.boolean(),
    question: z.string().optional(),
    reason: z.string().optional(),
  }).optional(),
}).superRefine((value, context) => {
  if (value.taskType === "needs_clarification") {
    if (!value.clarification?.required) {
      context.addIssue({ code: "custom", path: ["clarification", "required"], message: "clarification.required must be true" });
    }
    if (!value.clarification?.question?.trim()) {
      context.addIssue({ code: "custom", path: ["clarification", "question"], message: "clarification.question is required" });
    }
  }
});

export const thinkingResultSchema = z.object({
  id: nonEmptyString,
  projectId: nonEmptyString,
  runId: nonEmptyString,
  userFacingUnderstanding: nonEmptyString,
  promptClassification: promptClassificationSchema,
  extractedWishes: z.array(extractedWishSchema),
  ecommerceInterpretation: ecommerceInterpretationSchema,
  constraints: thinkingConstraintsSchema,
  assumptions: z.array(assumptionSchema),
  ambiguities: z.array(ambiguitySchema),
  conflicts: z.array(conflictSchema),
  riskAssessment: riskAssessmentSchema,
  suggestedAcceptanceCriteria: z.array(nonEmptyString),
  downstreamTask: agentTaskSchema,
}).superRefine((value, context) => {
  if (value.downstreamTask.projectId !== value.projectId) {
    context.addIssue({ code: "custom", path: ["downstreamTask", "projectId"], message: "downstreamTask.projectId must match projectId" });
  }
  if (value.downstreamTask.runId !== value.runId) {
    context.addIssue({ code: "custom", path: ["downstreamTask", "runId"], message: "downstreamTask.runId must match runId" });
  }
});

export const thinkingRunSummarySchema = z.object({
  thinkingResultId: nonEmptyString,
  userFacingUnderstanding: nonEmptyString,
  lifecycleIntent: lifecycleIntentSchema,
  normalizedGoal: nonEmptyString,
  extractedWishCount: z.number().int().nonnegative(),
  riskLevel: riskLevelSchema,
  requiresUserConfirmation: z.boolean(),
  downstreamTaskType: agentTaskTypeSchema,
  createdAt: nonEmptyString,
});

export type ThinkingInput = z.infer<typeof thinkingInputSchema>;
export type PreflightResult = z.infer<typeof preflightResultSchema>;
export type ThinkingResult = z.infer<typeof thinkingResultSchema>;
export type ThinkingRunSummary = z.infer<typeof thinkingRunSummarySchema>;
export type AgentTask = z.infer<typeof agentTaskSchema>;
export type AgentTaskType = z.infer<typeof agentTaskTypeSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;

type JsonSchema = Record<string, unknown>;

function strictObjectSchema(properties: Record<string, unknown>, required: readonly string[]): JsonSchema {
  return { type: "object", additionalProperties: false, properties, required: [...required] };
}

function arrayOf(items: JsonSchema): JsonSchema {
  return { type: "array", items };
}

function optionalNullableString(): JsonSchema {
  return { anyOf: [{ type: "string" }, { type: "null" }] };
}

const stringSchema = { type: "string" } as const;
const numberSchema = { type: "number" } as const;
const booleanSchema = { type: "boolean" } as const;
const stringArraySchema = arrayOf(stringSchema);
const priorityJsonSchema = { type: "string", enum: ["must_have", "should_have", "nice_to_have"] };
const riskJsonSchema = { type: "string", enum: ["low", "medium", "high"] };

const agentTaskRequirementProviderSchema = strictObjectSchema(
  {
    id: stringSchema,
    description: stringSchema,
    sourceWishId: stringSchema,
    priority: priorityJsonSchema,
    acceptanceCriteria: stringArraySchema,
  },
  ["id", "description", "sourceWishId", "priority", "acceptanceCriteria"],
);

const targetScopeProviderSchema = strictObjectSchema(
  {
    pages: stringArraySchema,
    sections: stringArraySchema,
    features: stringArraySchema,
    filesHint: stringArraySchema,
    dataModels: stringArraySchema,
  },
  ["pages", "sections", "features", "filesHint", "dataModels"],
);

const executionPolicyProviderSchema = strictObjectSchema(
  {
    allowInitSource: booleanSchema,
    allowPatchSource: booleanSchema,
    allowPackageChange: booleanSchema,
    allowConfigChange: booleanSchema,
    allowPreviewRestart: booleanSchema,
    requireHumanConfirmation: booleanSchema,
  },
  ["allowInitSource", "allowPatchSource", "allowPackageChange", "allowConfigChange", "allowPreviewRestart", "requireHumanConfirmation"],
);

const clarificationProviderSchema = strictObjectSchema(
  {
    required: booleanSchema,
    question: optionalNullableString(),
    reason: optionalNullableString(),
  },
  ["required", "question", "reason"],
);

const agentTaskProviderSchema = strictObjectSchema(
  {
    taskId: stringSchema,
    projectId: stringSchema,
    runId: stringSchema,
    taskType: { type: "string", enum: ["init_storefront_project", "incremental_source_update", "content_update", "design_update", "product_data_update", "bug_fix", "answer_question", "needs_clarification"] },
    normalizedGoal: stringSchema,
    userPrompt: stringSchema,
    requirements: arrayOf(agentTaskRequirementProviderSchema),
    targetScope: targetScopeProviderSchema,
    executionPolicy: executionPolicyProviderSchema,
    clarification: { anyOf: [clarificationProviderSchema, { type: "null" }] },
  },
  ["taskId", "projectId", "runId", "taskType", "normalizedGoal", "userPrompt", "requirements", "targetScope", "executionPolicy", "clarification"],
);

export const thinkingResultProviderSchema = strictObjectSchema(
  {
    id: stringSchema,
    projectId: stringSchema,
    runId: stringSchema,
    userFacingUnderstanding: stringSchema,
    promptClassification: strictObjectSchema(
      {
        lifecycleIntent: { type: "string", enum: ["init_project", "update_project", "modify_design", "modify_content", "modify_products", "add_feature", "fix_bug", "explain_project", "unknown"] },
        confidence: numberSchema,
        reasonSummary: stringSchema,
      },
      ["lifecycleIntent", "confidence", "reasonSummary"],
    ),
    extractedWishes: arrayOf(strictObjectSchema(
      {
        id: stringSchema,
        type: { type: "string", enum: ["explicit", "implicit", "inferred"] },
        description: stringSchema,
        priority: priorityJsonSchema,
        confidence: numberSchema,
        evidence: stringSchema,
      },
      ["id", "type", "description", "priority", "confidence", "evidence"],
    )),
    ecommerceInterpretation: strictObjectSchema(
      {
        primaryGoal: { type: "string", enum: ["conversion", "product_discovery", "trust_building", "brand_positioning", "checkout_improvement", "content_update", "technical_fix", "project_initialization"] },
        affectedPages: stringArraySchema,
        affectedSections: stringArraySchema,
        affectedFeatures: stringArraySchema,
        affectedDataModels: stringArraySchema,
        expectedBusinessImpact: stringSchema,
      },
      ["primaryGoal", "affectedPages", "affectedSections", "affectedFeatures", "affectedDataModels", "expectedBusinessImpact"],
    ),
    constraints: strictObjectSchema(
      {
        explicitConstraints: stringArraySchema,
        inferredConstraints: stringArraySchema,
        doNotChange: stringArraySchema,
        styleConstraints: stringArraySchema,
        technicalConstraints: stringArraySchema,
      },
      ["explicitConstraints", "inferredConstraints", "doNotChange", "styleConstraints", "technicalConstraints"],
    ),
    assumptions: arrayOf(strictObjectSchema(
      { id: stringSchema, description: stringSchema, reason: stringSchema, risk: riskJsonSchema },
      ["id", "description", "reason", "risk"],
    )),
    ambiguities: arrayOf(strictObjectSchema(
      {
        id: stringSchema,
        question: stringSchema,
        impact: riskJsonSchema,
        recommendedHandling: { type: "string", enum: ["use_default", "ask_user", "require_confirmation", "block"] },
        defaultResolution: optionalNullableString(),
      },
      ["id", "question", "impact", "recommendedHandling", "defaultResolution"],
    )),
    conflicts: arrayOf(strictObjectSchema(
      {
        id: stringSchema,
        description: stringSchema,
        conflictWith: { type: "string", enum: ["project_state", "recent_change", "tech_stack", "security_policy", "ecommerce_rule"] },
        severity: riskJsonSchema,
        resolution: { type: "string", enum: ["override", "preserve_existing", "ask_user", "block"] },
      },
      ["id", "description", "conflictWith", "severity", "resolution"],
    )),
    riskAssessment: strictObjectSchema(
      { level: riskJsonSchema, reasons: stringArraySchema, requiresUserConfirmation: booleanSchema },
      ["level", "reasons", "requiresUserConfirmation"],
    ),
    suggestedAcceptanceCriteria: stringArraySchema,
    downstreamTask: agentTaskProviderSchema,
  },
  ["id", "projectId", "runId", "userFacingUnderstanding", "promptClassification", "extractedWishes", "ecommerceInterpretation", "constraints", "assumptions", "ambiguities", "conflicts", "riskAssessment", "suggestedAcceptanceCriteria", "downstreamTask"],
);
