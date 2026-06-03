export type ProjectStateStatus =
  | "empty"
  | "initializing"
  | "initialized"
  | "updating"
  | "failed"
  | "archived";

export type ProjectStatus = ProjectStateStatus;

export type PackageInstallType = "dependencies" | "devDependencies";

export type ProjectState = {
  projectId: string;
  status: ProjectStateStatus;
  stack: {
    framework: "tanstack-start";
    router: "tanstack-router";
    serverState: "tanstack-query";
    ui: "react";
    styling: "tailwindcss";
    bundler: "vite";
    viteVersion: "8";
    language: "typescript";
    packageManager: "npm" | "pnpm" | "yarn" | "bun";
    packageProfileId: string;
  };
  packagePolicy: {
    registryVersion: string;
    initializedPackages: Array<{
      name: string;
      version: string;
      installType: PackageInstallType;
    }>;
  };
  ecommerceSpec: {
    storeType:
      | "fashion"
      | "cosmetics"
      | "electronics"
      | "furniture"
      | "food"
      | "single-product"
      | "general";
    targetCustomers: string[];
    productCategories: string[];
    mainProducts: Array<{
      id: string;
      name: string;
      category?: string;
      price?: number;
      compareAtPrice?: number;
      description?: string;
      imagePrompt?: string;
      attributes?: Record<string, string | number | boolean>;
    }>;
    requiredFeatures: string[];
  };
  brand: {
    name: string;
    tagline?: string;
    tone:
      | "minimal"
      | "premium"
      | "luxury"
      | "friendly"
      | "playful"
      | "bold"
      | "streetwear"
      | "organic"
      | "tech";
    colors: {
      primary: string;
      secondary?: string;
      accent?: string;
      background?: string;
      foreground?: string;
    };
    typography?: {
      heading?: string;
      body?: string;
    };
    visualStyle?: string;
  };
  pages: Array<{
    path: string;
    name: string;
    purpose: string;
    sections: string[];
    status: "planned" | "implemented" | "needs-update";
  }>;
  features: {
    productListing: boolean;
    productDetail: boolean;
    cart: boolean;
    cartDrawer: boolean;
    checkout: boolean;
    productSearch: boolean;
    productFilter: boolean;
    wishlist: boolean;
    reviews: boolean;
    promotions: boolean;
    newsletter: boolean;
    auth: boolean;
    adminDashboard: boolean;
    paymentIntegration: "none" | "mock" | "cod" | "stripe" | "paypal";
  };
  constraints: {
    doNotChange: string[];
    preferredComponents: string[];
    forbiddenLibraries: string[];
    notes: string[];
  };
  fileManifest: FileManifestEntry[];
  decisionLog: Array<{
    at: string;
    decision: string;
    reason: string;
  }>;
  recentChanges: Array<{
    at: string;
    runId: string;
    userPrompt: string;
    summary: string;
    changedFiles: string[];
    validationStatus: "passed" | "failed" | "skipped";
  }>;
  designState?: {
    templateId: string;
    designSourcePath: string;
    designSourceHash: string;
    designCopiedAt: string;
    designLastLoadedAt?: string;
  };
};

export type FileManifestEntry = {
  path: string;
  kind:
    | "route"
    | "component"
    | "hook"
    | "store"
    | "data"
    | "api"
    | "config"
    | "style"
    | "test"
    | "other";
  purpose: string;
  symbols: string[];
  lastModifiedByAgentAt?: string;
};


export type ProjectMessageRunState = {
  projectId: string;
  messageId: string;
  phase:
    | "created"
    | "thinking"
    | "code_context"
    | "code_tool_loop"
    | "patching"
    | "validating"
    | "repairing"
    | "preview_sync"
    | "completed"
    | "failed"
    | "human_review_required";
  currentTool?: string;
  changedFiles: string[];
  validationStatus?: "passed" | "failed" | "skipped";
  snapshotId?: string;
  updatedAt: string;
};

export type ProjectToolExecutionLog = {
  id: string;
  projectId: string;
  messageId: string;
  toolName: string;
  category: "inspect" | "mutate" | "validate" | "snapshot" | "preview";
  status: "started" | "completed" | "failed" | "blocked";
  safeArgsSummary: string;
  safeResultSummary?: string;
  errorCode?: string;
  recoverable?: boolean;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
};

export type AgentRunStatus =
  | "streaming"
  | "awaiting_input"
  | "completed"
  | "failed"
  | "stopped";

export type AgentRun = {
  id: string;
  projectId: string;
  userId?: string;
  parentMessageId?: string;
  retryOfRunId?: string;
  userPrompt: string;
  reasoningEffort?: "low" | "medium" | "high" | "xhigh";
  planMode: boolean;
  intent?: BuilderIntent;
  plan?: ChangePlan;
  status: AgentRunStatus;
  modelUsage?: Record<string, unknown>;
  thinking?: {
    thinkingResultId: string;
    userFacingUnderstanding: string;
    lifecycleIntent: string;
    normalizedGoal: string;
    extractedWishCount: number;
    riskLevel: "low" | "medium" | "high";
    requiresUserConfirmation: boolean;
    downstreamTaskType: string;
    createdAt: string;
  };
  affectedFiles: string[];
  validationResult?: ValidationResult;
  codeToolRunState?: ProjectMessageRunState;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
};

export type BuilderIntent = {
  intent:
    | "init_project"
    | "add_feature"
    | "modify_design"
    | "modify_content"
    | "modify_products"
    | "fix_bug"
    | "integrate_service"
    | "explain_project"
    | "rebuild_project"
    | "unknown";
  confidence: number;
  userGoal: string;
  normalizedRequirement: string;
  ecommerceMeaning: {
    affectedPages: string[];
    affectedFeatures: string[];
    affectedDataModels: string[];
    businessImpact: string;
  };
  shouldAskClarifyingQuestion: boolean;
  clarificationQuestion: string | null;
  riskLevel: "low" | "medium" | "high";
};

export type WebsiteSpec = {
  store: {
    name: string;
    type: ProjectState["ecommerceSpec"]["storeType"];
    description: string;
    targetCustomers: string[];
  };
  brand: ProjectState["brand"];
  pages: Array<{
    path: string;
    name: string;
    sections: string[];
  }>;
  products: ProjectState["ecommerceSpec"]["mainProducts"];
  features: Partial<ProjectState["features"]>;
  content: {
    heroTitle: string;
    heroSubtitle: string;
    primaryCta: string;
    secondaryCta?: string;
    trustSignals: string[];
    faq: Array<{ question: string; answer: string }>;
  };
};

export type ChangePlan = {
  summary: string;
  changeType:
    | "init_source"
    | "create_files"
    | "modify_files"
    | "delete_files"
    | "update_state_only"
    | "explain_only";
  affectedFiles: string[];
  operations: Array<{
    type:
      | "create_file"
      | "modify_file"
      | "delete_file"
      | "update_project_state"
      | "run_validation";
    path?: string;
    reason: string;
  }>;
  acceptanceCriteria: string[];
  validationCommands: string[];
  riskLevel: "low" | "medium" | "high";
  requiresUserConfirmation: boolean;
};

export type FileOperation =
  | { type: "create_file"; path: string; content: string }
  | { type: "modify_file"; path: string; content: string }
  | { type: "delete_file"; path: string };

export type PatchResult = {
  summary: string;
  operations: FileOperation[];
  changedFiles: string[];
  projectStatePatch?: Partial<ProjectState>;
};

export type ValidationResult = {
  ok: boolean;
  commands: Array<{
    command: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
  }>;
  summary: string;
  errors: string[];
};

export type ProjectSnapshot = {
  id: string;
  projectId: string;
  userId?: string;
  runId?: string;
  kind: "initial" | "pre_change" | "post_change" | "rollback";
  summary: string;
  projectState: ProjectState;
  fileManifest: FileManifestEntry[];
  workspaceRevisionId?: string;
  createdAt: string;
};

export type DevRuntimeStatus =
  | "installing"
  | "installed"
  | "starting"
  | "running"
  | "fixing"
  | "error"
  | "stopped";

export type DevRuntimeDnsStatus = "none" | "creating" | "ready" | "delete_pending" | "error";
export type DevRuntimeInstallStatus = "idle" | "installing" | "installed" | "failed";

export type DevRuntime = {
  status: DevRuntimeStatus;
  enabled: boolean;
  pid: number | null;
  port: number | null;
  previewHost: string | null;
  cloudflareDnsRecordId: string | null;
  dnsStatus: DevRuntimeDnsStatus;
  installStatus: DevRuntimeInstallStatus;
  installStartedAt: string | null;
  installCompletedAt: string | null;
  devStartedAt: string | null;
  previewUrl: string | null;
  lastAccessedAt: string | null;
  installLog: string | null;
  devLog: string | null;
  lastError: string | null;
  lastErrorTier: "code" | "config" | "system" | null;
  retryCount: number;
  maxRetries: number;
  operatorAttentionRequired: boolean;
  fixAttempts: Array<{
    attempt: number;
    changedFiles: string[];
    errorBefore: string;
    errorAfter: string | null;
    success: boolean;
  }>;
};

export const EMPTY_DEV_RUNTIME: DevRuntime = {
  status: "stopped",
  enabled: false,
  pid: null,
  port: null,
  previewHost: null,
  cloudflareDnsRecordId: null,
  dnsStatus: "none",
  installStatus: "idle",
  installStartedAt: null,
  installCompletedAt: null,
  devStartedAt: null,
  previewUrl: null,
  lastAccessedAt: null,
  installLog: null,
  devLog: null,
  lastError: null,
  lastErrorTier: null,
  retryCount: 0,
  maxRetries: 3,
  operatorAttentionRequired: false,
  fixAttempts: [],
};

export type AgentStreamEvent =
  | { type: "agent_started"; runId: string; projectId: string; message: string }
  | { type: "state_loaded"; status: ProjectStatus }
  | { type: "thinking_started"; runId: string; message: string }
  | {
      type: "thinking_context_loaded";
      runId: string;
      projectStatus: ProjectStatus;
      hasInitializedSource?: boolean;
    }
  | {
      type: "user_wish_extracted";
      runId: string;
      understanding: string;
      wishes: Array<{
        type: "explicit" | "implicit" | "inferred";
        description: string;
        priority: "must_have" | "should_have" | "nice_to_have";
      }>;
    }
  | { type: "thinking_needs_clarification"; runId: string; question: string; reason: string }
  | {
      type: "thinking_completed";
      runId: string;
      taskType:
        | "init_storefront_project"
        | "incremental_source_update"
        | "content_update"
        | "design_update"
        | "product_data_update"
        | "bug_fix"
        | "answer_question"
        | "needs_clarification";
      normalizedGoal: string;
      riskLevel: "low" | "medium" | "high";
      summary?: string;
      intent?: BuilderIntent["intent"];
      confidence?: number;
      executionMode?: "apply" | "plan" | "explain" | "review";
      shouldApplyCode?: boolean;
      affectedPages?: string[];
      affectedFeatures?: string[];
      conversionGoal?: string;
    }
  | { type: "intent_detected"; intent: BuilderIntent }
  | { type: "clarification_required"; runId?: string; question: string; reason?: string }
  | { type: "context_retrieved"; files: Array<{ path: string; reason: string }> }
  | { type: "plan_created"; plan: ChangePlan }
  | { type: "source_generation_started"; message: string }
  | { type: "assistant_message_delta"; delta: string }
  | { type: "file_changed"; path: string; operation: "created" | "modified" | "deleted" }
  | { type: "validation_started"; commands: string[] }
  | { type: "validation_finished"; ok: boolean; summary: string; errors?: string[] }
  | { type: "project_state_updated"; projectState: ProjectState }
  | { type: "done"; runId: string; summary: string; changedFiles: string[]; previewUrl?: string }
  | { type: "error"; code: string; message: string; recoverable: boolean }
  | { type: "design_file_generated"; projectId: string; messageId: string; data: { source: "ai" | "fallback"; destinationPath: string; byteSize: number } }
  | { type: "design_file_regenerated"; projectId: string; messageId: string; data: { source: "ai" | "fallback"; destinationPath: string; byteSize: number } }
  | { type: "design_file_token_patched"; projectId: string; messageId: string; data: { destinationPath: string; appliedRoles: string[]; previousHash: string; hash: string; byteSize: number } }
  | { type: "design_rules_loaded"; projectId: string; messageId: string; data: { source: string; summary: string; hash: string } };

export function createEmptyProjectState(projectId: string): ProjectState {
  return {
    projectId,
    status: "empty",
    stack: {
      framework: "tanstack-start",
      router: "tanstack-router",
      serverState: "tanstack-query",
      ui: "react",
      styling: "tailwindcss",
      bundler: "vite",
      viteVersion: "8",
      language: "typescript",
      packageManager: "pnpm",
      packageProfileId: "default-storefront-v1",
    },
    packagePolicy: {
      registryVersion: "initial-v1",
      initializedPackages: [],
    },
    ecommerceSpec: {
      storeType: "general",
      targetCustomers: [],
      productCategories: [],
      mainProducts: [],
      requiredFeatures: [],
    },
    brand: {
      name: "AI Storefront",
      tone: "friendly",
      colors: { primary: "#111827" },
    },
    pages: [],
    features: {
      productListing: false,
      productDetail: false,
      cart: false,
      cartDrawer: false,
      checkout: false,
      productSearch: false,
      productFilter: false,
      wishlist: false,
      reviews: false,
      promotions: false,
      newsletter: false,
      auth: false,
      adminDashboard: false,
      paymentIntegration: "none",
    },
    constraints: {
      doNotChange: [],
      preferredComponents: [],
      forbiddenLibraries: [],
      notes: [],
    },
    fileManifest: [],
    decisionLog: [],
    recentChanges: [],
  };
}
