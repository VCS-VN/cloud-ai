import type { ToolHook } from "./hook-types";
import type { CodeToolDefinition, ToolExecutionContext } from "../code-agent-types";
import { evaluateProjectRiskPolicy } from "../services/project-risk-policy.server";
import { GENERATED_PROJECT_ENV_POLICY_MESSAGE, isProtectedGeneratedEnvPath } from "../services/project-patch-service.server";
import { isStorefrontUiPath } from "../services/project-path-guard.server";

export function createPreWriteHooks(): ToolHook[] {
  return [
    sandboxGateHook,
    phaseGateHook,
    inspectionGateHook,
    snapshotGateHook,
    protectedEnvGateHook,
    tasteSkillGateHook,
    riskPolicyHook,
  ];
}

const sandboxGateHook: ToolHook = {
  type: "pre_write",
  applicable: (tool) => tool.category === "mutate",
  handler: async ({ tool, context }) => {
    if ((context as any).sandboxMode === "read-only") {
      return { ok: false, error: { code: "POLICY_FORBIDDEN", message: "Mutation tools are not allowed in read-only mode.", recoverable: true } };
    }
    return { ok: true };
  },
};

const phaseGateHook: ToolHook = {
  type: "pre_write",
  applicable: (tool) => tool.category === "mutate",
  handler: async ({ context }) => {
    const phase = (context as any).phase as string | undefined;
    const registry = (context as any).registry as { listForPhase?: (phase: any) => CodeToolDefinition[] } | undefined;
    const tool = (context as any).tool as CodeToolDefinition | undefined;
    if (phase && registry?.listForPhase && tool) {
      const allowed = registry.listForPhase(phase).some((t) => t.name === tool.name);
      if (!allowed) {
        return { ok: false, error: { code: "PHASE_FORBIDDEN", message: `Tool "${tool.name}" is not allowed in phase "${phase}".`, recoverable: true } };
      }
    }
    return { ok: true };
  },
};

const inspectionGateHook: ToolHook = {
  type: "pre_write",
  applicable: (tool) => tool.category === "mutate",
  handler: async ({ context }) => {
    if (!(context as any).inspectionCompleted) {
      return { ok: false, error: { code: "INSPECTION_REQUIRED", message: "The agent must inspect project code before using mutation tools.", recoverable: true } };
    }
    return { ok: true };
  },
};

const snapshotGateHook: ToolHook = {
  type: "pre_write",
  applicable: (tool) => tool.category === "mutate",
  handler: async ({ context }) => {
    if (!(context as unknown as { __codeToolSnapshotId?: string }).__codeToolSnapshotId) {
      return { ok: false, error: { code: "SNAPSHOT_REQUIRED", message: "Create a project snapshot before the first mutation tool call.", recoverable: true } };
    }
    return { ok: true };
  },
};

const protectedEnvGateHook: ToolHook = {
  type: "pre_write",
  applicable: (tool) => tool.category === "mutate",
  handler: async ({ tool, args }) => {
    const changedFiles = extractPotentialChangedFiles(args);
    if (changedFiles.some((file) => safeProtectedPath(file))) {
      console.warn(JSON.stringify({ event: "generated_project_env_edit_blocked", tool: tool.name }));
      return { ok: false, error: { code: "PROTECTED_ENV_FILE", message: GENERATED_PROJECT_ENV_POLICY_MESSAGE, recoverable: true } };
    }
    return { ok: true };
  },
};

const tasteSkillGateHook: ToolHook = {
  type: "pre_write",
  applicable: (tool) => tool.category === "mutate",
  handler: async ({ context, args }) => {
    const flags = (context as any).flags;
    const tasteSkillLoaded = flags?.tasteSkillLoaded === true;
    const changedFiles = extractPotentialChangedFiles(args);
    const designFacingPaths = changedFiles.filter((file) => isDesignFacingMutationPath(file));
    if (!tasteSkillLoaded && designFacingPaths.length > 0) {
      return {
        ok: false,
        error: {
          code: "TASTE_SKILL_REQUIRED",
          message: `Storefront design cannot be authored without the taste skill. Affected paths: ${designFacingPaths.join(", ")}. Call project_read_taste_skill first (or use a run where the Builder preloaded it).`,
          recoverable: true,
        },
      };
    }
    return { ok: true };
  },
};

const riskPolicyHook: ToolHook = {
  type: "pre_write",
  applicable: (tool) => tool.category === "mutate",
  handler: async ({ tool, args }) => {
    const changedFiles = extractPotentialChangedFiles(args);
    const risk = evaluateProjectRiskPolicy({ changedFiles, highRisk: tool.highRisk });
    if (risk.requiresHumanReview) {
      return { ok: false, error: { code: "HUMAN_REVIEW_REQUIRED", message: risk.reasons.join(" "), recoverable: false } };
    }
    return { ok: true };
  },
};

function extractPotentialChangedFiles(args: unknown) {
  if (!args || typeof args !== "object") return [];
  const record = args as Record<string, unknown>;
  if (Array.isArray(record.expectedChangedFiles)) return record.expectedChangedFiles.filter((v): v is string => typeof v === "string");
  if (typeof record.path === "string") return [record.path];
  return [];
}

function isDesignFacingMutationPath(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  if (normalized === "DESIGN.md") return true;
  return isStorefrontUiPath(normalized) || normalized.startsWith("public/");
}

function isUiRelatedFilePath(filePath: string): boolean {
  return isDesignFacingMutationPath(filePath);
}

function safeProtectedPath(filePath: string) {
  try {
    return isProtectedGeneratedPath(filePath);
  } catch {
    return false;
  }
}

function isProtectedGeneratedPath(filePath: string) {
  return isProtectedGeneratedEnvPath(filePath);
}
