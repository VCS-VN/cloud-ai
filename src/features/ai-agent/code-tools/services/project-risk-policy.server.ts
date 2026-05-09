import { CODE_TOOL_LIMITS } from "../code-tool-registry.server";

const SENSITIVE_PATH_PATTERNS = [
  /^\.env(?:\.|$)/,
  /(^|\/)\.env(?:\.|$)/,
  /^package(?:-lock)?\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^bun\.lockb?$/,
  /^vite\.config\./,
  /^src\/routeTree\.gen\.ts$/,
];

export type ProjectRiskPolicyResult = {
  requiresHumanReview: boolean;
  reasons: string[];
};

export function evaluateProjectRiskPolicy(input: {
  changedFiles: string[];
  maxChangedFilesWithoutReview?: number;
  highRisk?: boolean;
}): ProjectRiskPolicyResult {
  const reasons: string[] = [];
  const maxChangedFiles = input.maxChangedFilesWithoutReview ?? CODE_TOOL_LIMITS.maxFilesChangedWithoutReview;
  const uniqueFiles = [...new Set(input.changedFiles)];

  if (input.highRisk) reasons.push("Tool or request is marked high risk.");
  if (uniqueFiles.length > maxChangedFiles) reasons.push("Change touches too many files for automatic execution.");
  if (uniqueFiles.some(isSensitivePath)) reasons.push("Change touches sensitive project files.");

  return { requiresHumanReview: reasons.length > 0, reasons };
}

export function isSensitivePath(path: string) {
  return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(path));
}
