import { isBlockedProjectPath } from "@/features/agents/codex/boundary/protected-paths";

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
