import { isAbsolute, normalize, relative, resolve, sep } from "node:path";

export type ProjectPathGuardResult =
  | { ok: true; relativePath: string; absolutePath: string }
  | { ok: false; code: "UNSAFE_PROJECT_PATH" | "FORBIDDEN_PROJECT_PATH"; message: string };

const FORBIDDEN_EXACT_NAMES = new Set([
  ".env.*",
  "routeTree.gen.ts",
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".npmrc",
  ".pnpmrc",
]);

const FORBIDDEN_SEGMENTS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vite",
  ".cache",
  "coverage",
  "dist",
  "build",
  "node_modules",
]);

const SECRET_FILE_PATTERNS = [/\.pem$/i, /\.key$/i, /(^|[._-])secret([._-]|$)/i, /(^|[._-])token([._-]|$)/i];

export function guardProjectPath(input: { workspaceRoot: string; path?: string }): ProjectPathGuardResult {
  const rawPath = (input.path ?? "").replaceAll("\\", "/").trim();

  if (rawPath === "") {
    return { ok: true, relativePath: "", absolutePath: resolve(input.workspaceRoot) };
  }

  if (isAbsolute(rawPath) || rawPath.startsWith("~") || rawPath.includes("\0")) {
    return { ok: false, code: "UNSAFE_PROJECT_PATH", message: "Project paths must be relative to the workspace." };
  }

  const normalized = normalize(rawPath).replaceAll("\\", "/");
  if (normalized === ".." || normalized.startsWith("../")) {
    return { ok: false, code: "UNSAFE_PROJECT_PATH", message: "Project path escapes the workspace." };
  }

  if (isForbiddenProjectPath(normalized)) {
    return { ok: false, code: "FORBIDDEN_PROJECT_PATH", message: "Project path is forbidden by inspection policy." };
  }

  const workspaceRoot = resolve(input.workspaceRoot);
  const absolutePath = resolve(workspaceRoot, normalized);
  const rootRelative = relative(workspaceRoot, absolutePath);

  if (rootRelative === ".." || rootRelative.startsWith(`..${sep}`) || isAbsolute(rootRelative)) {
    return { ok: false, code: "UNSAFE_PROJECT_PATH", message: "Project path escapes the workspace." };
  }

  return { ok: true, relativePath: normalized === "." ? "" : normalized, absolutePath };
}

export function isForbiddenProjectPath(path: string) {
  const normalized = normalize(path).replaceAll("\\", "/");
  const segments = normalized.split("/").filter(Boolean);
  const basename = segments.at(-1) ?? normalized;

  if (segments.some((segment) => FORBIDDEN_SEGMENTS.has(segment))) return true;
  if (basename === ".env" || basename.startsWith(".env.")) return false;
  if (FORBIDDEN_EXACT_NAMES.has(basename)) return true;
  return SECRET_FILE_PATTERNS.some((pattern) => pattern.test(basename));
}
