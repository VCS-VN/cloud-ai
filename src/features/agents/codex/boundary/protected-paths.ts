export const BLOCKED_PROJECT_PATHS: readonly string[] = [
  "package.json",
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lockb",
  ".env",
  "src/main.ts",
  "src/main.tsx",
  "src/router.ts",
  "src/router.tsx",
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mts",
  "tsconfig.json",
  "tailwind.config.ts",
  "tailwind.config.js",
  "postcss.config.cjs",
  "public/sw.js",
];

export const BLOCKED_PROJECT_PATH_PATTERNS: readonly RegExp[] = [
  /^\.env(\..+)?$/,
];

export const ALLOWED_AUDIT_PROJECT_PATH_PATTERNS: readonly RegExp[] = [
  /^src\/routes\//,
  /^src\/components\//,
  /^src\/styles\//,
  /^src\/lib\//,
  /^src\/hooks\//,
  /^src\/shared\/sample-data\//,
  /^public\/assets\//,
];

export type ProtectedPathDecision =
  | { kind: "blocked"; matchedRule: string }
  | { kind: "allowed_audit"; matchedRule: string }
  | { kind: "outside_scope" };

export function classifyProjectPath(relPath: string): ProtectedPathDecision {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");

  for (const blocked of BLOCKED_PROJECT_PATHS) {
    if (normalized === blocked) return { kind: "blocked", matchedRule: blocked };
  }
  for (const pattern of BLOCKED_PROJECT_PATH_PATTERNS) {
    if (pattern.test(normalized))
      return { kind: "blocked", matchedRule: pattern.source };
  }
  for (const pattern of ALLOWED_AUDIT_PROJECT_PATH_PATTERNS) {
    if (pattern.test(normalized))
      return { kind: "allowed_audit", matchedRule: pattern.source };
  }
  return { kind: "outside_scope" };
}

export function isBlockedProjectPath(relPath: string): boolean {
  return classifyProjectPath(relPath).kind === "blocked";
}
