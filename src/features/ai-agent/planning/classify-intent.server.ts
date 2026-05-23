import type { BuilderIntent, ProjectState } from "../project/project-state.schema";
import { classifyDesignIntent, type DesignIntentLabel } from "./design-intent-heuristic";

export type DesignChangeClassification =
  | { kind: "feature_update"; label: "Feature or content update - DESIGN.md unchanged" }
  | { kind: "token_specific"; label: "Token-specific design change - patch relevant token values" }
  | { kind: "identity_redesign"; label: "Identity-level redesign - regenerate design direction" };

/**
 * Classifies a user prompt into one of three design change categories
 * for storefront design evolution:
 * - feature_update: behavior/copy/data changes, DESIGN.md unchanged
 * - token_specific: names a specific design role (color, font, radius, shadow)
 * - identity_redesign: broad style/mood/audience/positioning change
 */
export function classifyDesignChange(
  prompt: string,
  projectStatus: string,
): DesignChangeClassification {
  const label = classifyDesignIntent({ prompt, projectStatus });

  switch (label.kind) {
    case "init":
      return { kind: "identity_redesign", label: "Identity-level redesign - regenerate design direction" };
    case "update_no_design":
      return { kind: "feature_update", label: "Feature or content update - DESIGN.md unchanged" };
    case "update_token":
      return { kind: "token_specific", label: "Token-specific design change - patch relevant token values" };
    case "redesign":
      return { kind: "identity_redesign", label: "Identity-level redesign - regenerate design direction" };
  }
}

const HIGH_RISK_PATTERNS = {
  payment: /stripe|paypal|payment|thanh toán thật|real payment/i,
  auth: /auth|login|customer account|tài khoản|đăng nhập/i,
  dependency: /dependency|dependencies|package|npm install|pnpm add|yarn add|bun add/i,
  buildConfig: /build config|vite config|vite|router config|deployment config/i,
  rebuild: /delete|xóa|rebuild|build lại|vue|framework|router|bundler/i,
};

export type HighRiskAssessment = {
  isHighRisk: boolean;
  category: "payment" | "auth" | "dependency" | "build_config" | "rebuild" | null;
  intent: BuilderIntent["intent"] | null;
  clarificationQuestion: string | null;
};

export function assessPromptRisk(prompt: string): HighRiskAssessment {
  const lower = prompt.toLowerCase();
  if (HIGH_RISK_PATTERNS.payment.test(lower)) {
    return highRisk("payment", "integrate_service", "Real payment integration needs credentials and explicit confirmation. How would you like to proceed?");
  }
  if (HIGH_RISK_PATTERNS.auth.test(lower)) {
    return highRisk("auth", "integrate_service", "Real authentication changes require confirmation and credential planning. Should the agent prepare a safe plan first?");
  }
  if (HIGH_RISK_PATTERNS.dependency.test(lower)) {
    return highRisk("dependency", "integrate_service", "Adding or changing dependencies requires confirmation before source changes. Which package policy should be used?");
  }
  if (HIGH_RISK_PATTERNS.buildConfig.test(lower)) {
    return highRisk("build_config", "rebuild_project", "Build configuration changes are high risk. Please confirm the intended change before the agent applies it.");
  }
  if (HIGH_RISK_PATTERNS.rebuild.test(lower)) {
    return highRisk("rebuild", "rebuild_project", "Rebuilds or framework changes can discard existing work. Please confirm before the agent applies changes.");
  }
  return { isHighRisk: false, category: null, intent: null, clarificationQuestion: null };
}

export async function classifyIntent(args: { prompt: string; projectState: ProjectState }): Promise<BuilderIntent> {
  const prompt = args.prompt.trim();
  const lower = prompt.toLowerCase();
  const highRisk = assessPromptRisk(prompt);
  const isProductDiscovery = /filter|lọc|search|size|price|product|sản phẩm/.test(lower);
  const intent: BuilderIntent["intent"] = args.projectState.status === "empty"
    ? "init_project"
    : highRisk.intent
      ?? (/fix|bug|lỗi/.test(lower)
        ? "fix_bug"
        : isProductDiscovery
          ? "add_feature"
          : /design|color|theme|giao diện|màu|luxury/.test(lower)
            ? "modify_design"
            : /name|tagline|copy|content|nội dung|tên shop/.test(lower)
              ? "modify_content"
              : "unknown");
  const affectedFeatures = /filter|lọc/.test(lower) ? ["productFilter"] : [];
  return {
    intent,
    confidence: intent === "unknown" ? 0.35 : 0.82,
    userGoal: prompt,
    normalizedRequirement: normalizeRequirementText(prompt),
    ecommerceMeaning: {
      affectedPages: affectedFeatures.includes("productFilter") ? ["/products"] : [],
      affectedFeatures,
      affectedDataModels: affectedFeatures.includes("productFilter") ? ["products"] : [],
      businessImpact: affectedFeatures.includes("productFilter") ? "Improve product discovery." : "Improve storefront experience.",
    },
    shouldAskClarifyingQuestion: highRisk.isHighRisk,
    clarificationQuestion: highRisk.clarificationQuestion,
    riskLevel: highRisk.isHighRisk ? "high" : "low",
  };
}

function highRisk(category: NonNullable<HighRiskAssessment["category"]>, intent: BuilderIntent["intent"], clarificationQuestion: string): HighRiskAssessment {
  return { isHighRisk: true, category, intent, clarificationQuestion };
}

function normalizeRequirementText(prompt: string) {
  return prompt.replace(/\s+/g, " ").trim();
}
