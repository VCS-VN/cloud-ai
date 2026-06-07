import { isBlockedProjectPath } from "@/features/agents/codex/boundary/protected-paths";
import type { Project } from "@/shared/project-types";

export type UpdateClassification = "small_update" | "new_route" | "unsupported";

export type UpdateClassifierInput = {
  prompt: string;
  fileManifest: string[];
};

export type UpdateClassifierResult = {
  kind: UpdateClassification;
  reason: string;
  blockedPaths: string[];
};

const NEW_ROUTE_HINTS = [
  /\badd(?:ing)?\s+(?:a\s+)?(?:new\s+)?(?:page|route|view)\b/i,
  /\bcreate\s+(?:a\s+)?(?:new\s+)?(?:page|route|view)\b/i,
  /\b(?:thêm|tạo)\s+(?:trang|route|view)\b/i,
  /\bnew\s+\/[a-z][\w-]*\b/i,
];

const UNSUPPORTED_HINTS = [
  /\binstall\s+\w+\s+package\b/i,
  /\bupgrade\s+(?:dependency|node|tsconfig)\b/i,
  /\bchange\s+(?:vite|tsconfig|tailwind)\.config\b/i,
];

const BLOCKED_PATH_MENTIONS = [
  /package\.json/i,
  /pnpm-lock\.yaml/i,
  /vite\.config\.(?:ts|js|mts)/i,
  /tsconfig\.json/i,
  /tailwind\.config\.(?:ts|js)/i,
  /\.env(?:\.\w+)?(?:\b|$)/i,
  /__root\.tsx/i,
];

export function classifyUpdatePrompt(
  input: UpdateClassifierInput,
): UpdateClassifierResult {
  const blocked: string[] = [];
  for (const pattern of BLOCKED_PATH_MENTIONS) {
    const match = input.prompt.match(pattern);
    if (match) blocked.push(match[0]);
  }
  for (const file of input.fileManifest) {
    if (isBlockedProjectPath(file) && input.prompt.includes(file)) {
      blocked.push(file);
    }
  }

  if (UNSUPPORTED_HINTS.some((p) => p.test(input.prompt))) {
    return {
      kind: "unsupported",
      reason: "matches_unsupported_intent",
      blockedPaths: blocked,
    };
  }

  if (blocked.length > 0) {
    return {
      kind: "unsupported",
      reason: "mentions_blocked_path",
      blockedPaths: blocked,
    };
  }

  if (NEW_ROUTE_HINTS.some((p) => p.test(input.prompt))) {
    return { kind: "new_route", reason: "matches_new_route_intent", blockedPaths: [] };
  }

  return { kind: "small_update", reason: "default_small_update", blockedPaths: [] };
}

export const SMALL_UPDATE_FILE_CAP = 20;

export type ResolvedBuilderRunKind = "init" | "update" | "new_route" | "unsupported";

export type ResolveBuilderRunKindInput = {
  project: Pick<Project, "status">;
  workspaceFiles: string[];
  prompt: string;
};

/**
 * Server-side resolution of the agent run kind (R5).
 * Empty workspace OR project.status === "draft" → init.
 * Otherwise delegate to classifyUpdatePrompt for update vs new-route vs unsupported.
 */
export function resolveBuilderRunKind(
  input: ResolveBuilderRunKindInput,
): ResolvedBuilderRunKind {
  const isEmptyWorkspace = input.workspaceFiles.length === 0;
  const isDraft = input.project.status === "draft";
  if (isEmptyWorkspace || isDraft) return "init";

  const classification = classifyUpdatePrompt({
    prompt: input.prompt,
    fileManifest: input.workspaceFiles,
  });
  if (classification.kind === "unsupported") return "unsupported";
  if (classification.kind === "new_route") return "new_route";
  return "update";
}
