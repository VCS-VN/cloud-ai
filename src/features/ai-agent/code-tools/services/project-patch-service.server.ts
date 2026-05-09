import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PatchResult } from "../code-agent-types";
import { CODE_TOOL_LIMITS } from "../code-tool-registry.server";
import { evaluateProjectRiskPolicy } from "./project-risk-policy.server";
import { guardProjectPath } from "./project-path-guard.server";
import { getPreviewRestartRequirement } from "./preview-restart-policy.server";

const PROTECTED_FILES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"]);
const FORBIDDEN_SEGMENTS = new Set([".git", "node_modules", "dist", "build", ".next", ".tanstack"]);
const SECRET_PATTERN = /(api[_-]?key|secret|token|password|private[_-]?key)\s*[:=]\s*["'][^"']{8,}["']/i;

export type PatchPolicyViolationCode =
  | "EMPTY_PATCH"
  | "PATCH_TOO_LARGE"
  | "TOO_MANY_CHANGED_FILES"
  | "FORBIDDEN_PATH"
  | "PROTECTED_FILE"
  | "PACKAGE_POLICY_VIOLATION"
  | "SECRET_LIKE_ADDITION"
  | "PATCH_APPLY_FAILED";

export class ProjectPatchPolicyError extends Error {
  constructor(public readonly code: PatchPolicyViolationCode, message: string) {
    super(message);
  }
}

export class ProjectPatchService {
  validatePatch(input: { patch: string; expectedChangedFiles?: string[] }) {
    if (!input.patch.trim()) throw new ProjectPatchPolicyError("EMPTY_PATCH", "Patch content is required.");
    if (Buffer.byteLength(input.patch, "utf8") > CODE_TOOL_LIMITS.maxPatchBytes) {
      throw new ProjectPatchPolicyError("PATCH_TOO_LARGE", "Patch exceeds the allowed size.");
    }

    const changedFiles = extractPatchFiles(input.patch);
    if (changedFiles.length > CODE_TOOL_LIMITS.maxFilesChangedWithoutReview) {
      throw new ProjectPatchPolicyError("TOO_MANY_CHANGED_FILES", "Patch changes too many files.");
    }

    for (const filePath of changedFiles) this.assertMutablePath(filePath);
    for (const filePath of input.expectedChangedFiles ?? []) this.assertMutablePath(filePath);

    const risk = evaluateProjectRiskPolicy({ changedFiles });
    if (risk.requiresHumanReview) {
      throw new ProjectPatchPolicyError("TOO_MANY_CHANGED_FILES", risk.reasons.join(" "));
    }

    if (hasSecretLikeAddition(input.patch)) {
      throw new ProjectPatchPolicyError("SECRET_LIKE_ADDITION", "Patch appears to add secret-like values.");
    }

    return { changedFiles };
  }

  async applyPatch(input: { workspaceRoot: string; patch: string; expectedChangedFiles?: string[] }): Promise<PatchResult> {
    const { changedFiles } = this.validatePatch(input);
    const filePatches = parseUnifiedPatch(input.patch);
    const modifiedFiles: string[] = [];
    const createdFiles: string[] = [];
    const deletedFiles: string[] = [];
    let insertions = 0;
    let deletions = 0;

    for (const filePatch of filePatches) {
      const targetPath = path.join(input.workspaceRoot, filePatch.path);
      const exists = await fileExists(targetPath);
      const oldContent = exists ? await readFile(targetPath, "utf8") : "";
      const nextContent = applyHunks(oldContent, filePatch.hunks);

      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, nextContent, "utf8");

      insertions += filePatch.insertions;
      deletions += filePatch.deletions;
      if (!exists) createdFiles.push(filePatch.path);
      else modifiedFiles.push(filePatch.path);
    }

    const previewRestart = getPreviewRestartRequirement(changedFiles);
    return {
      changedFiles,
      createdFiles,
      modifiedFiles,
      deletedFiles,
      insertions,
      deletions,
      requiresPreviewRestart: previewRestart.required,
      requiresPackageInstall: changedFiles.includes("package.json"),
      warnings: [],
    };
  }

  async createFile(input: { workspaceRoot: string; relativePath: string; content: string }): Promise<PatchResult> {
    this.assertMutablePath(input.relativePath);
    if (SECRET_PATTERN.test(input.content)) throw new ProjectPatchPolicyError("SECRET_LIKE_ADDITION", "File content appears to contain secret-like values.");
    const targetPath = path.join(input.workspaceRoot, input.relativePath);
    if (await fileExists(targetPath)) throw new ProjectPatchPolicyError("PATCH_APPLY_FAILED", "File already exists.");
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, input.content, "utf8");
    const previewRestart = getPreviewRestartRequirement([input.relativePath]);
    return {
      changedFiles: [input.relativePath],
      createdFiles: [input.relativePath],
      modifiedFiles: [],
      deletedFiles: [],
      insertions: input.content.split("\n").length,
      deletions: 0,
      requiresPreviewRestart: previewRestart.required,
      requiresPackageInstall: input.relativePath === "package.json",
      warnings: [],
    };
  }

  async deleteFile(input: { workspaceRoot: string; relativePath: string }): Promise<PatchResult> {
    const guarded = guardProjectPath({ workspaceRoot: input.workspaceRoot, path: input.relativePath });
    if (!guarded.ok) throw new ProjectPatchPolicyError("FORBIDDEN_PATH", guarded.message);
    const { rm } = await import("node:fs/promises");
    await rm(guarded.absolutePath, { force: true });
    return {
      changedFiles: [guarded.relativePath],
      createdFiles: [],
      modifiedFiles: [],
      deletedFiles: [guarded.relativePath],
      insertions: 0,
      deletions: 1,
      requiresPreviewRestart: false,
      requiresPackageInstall: false,
      warnings: [],
    };
  }
  async getDiff(input: { workspaceRoot: string; baselineRoot?: string; includePatch?: boolean; maxBytes?: number }) {
    if (!input.baselineRoot) return { changedFiles: [], patch: input.includePatch ? "" : undefined, truncated: false };
    const changedFiles = await diffDirectories(input.baselineRoot, input.workspaceRoot);
    const patch = input.includePatch ? changedFiles.map((filePath) => `diff -- ${filePath}`).join("\n") : undefined;
    const maxBytes = input.maxBytes ?? 20_000;
    if (patch && Buffer.byteLength(patch, "utf8") > maxBytes) {
      return { changedFiles, patch: patch.slice(0, maxBytes), truncated: true };
    }
    return { changedFiles, patch, truncated: false };
  }

  assertMutablePath(relativePath: string) {
    const normalized = normalizeProjectPath(relativePath);
    const parts = normalized.split("/");
    if (parts.some((part) => FORBIDDEN_SEGMENTS.has(part))) throw new ProjectPatchPolicyError("FORBIDDEN_PATH", "Path targets a forbidden directory.");
    if (PROTECTED_FILES.has(path.posix.basename(normalized))) throw new ProjectPatchPolicyError("PROTECTED_FILE", "Path targets a protected generated file.");
    if (normalized === "package.json") throw new ProjectPatchPolicyError("PACKAGE_POLICY_VIOLATION", "Package changes are not allowed by this mutation tool.");
  }
}

export function normalizeProjectPath(relativePath: string) {
  const withoutPrefix = relativePath.replace(/^([ab])\//, "").replaceAll("\\", "/");
  if (!withoutPrefix || withoutPrefix.startsWith("/") || withoutPrefix.startsWith("~") || withoutPrefix.split("/").includes("..")) {
    throw new ProjectPatchPolicyError("FORBIDDEN_PATH", "Path must be project-relative and safe.");
  }
  return withoutPrefix;
}

function extractPatchFiles(patch: string) {
  return Array.from(new Set([...patch.matchAll(/^\+\+\+\s+(?:b\/)?([^\n\r]+)$/gm)].map((match) => normalizeProjectPath(match[1] ?? ""))));
}

function hasSecretLikeAddition(patch: string) {
  return patch.split("\n").some((line) => line.startsWith("+") && !line.startsWith("+++") && SECRET_PATTERN.test(line));
}

function parseUnifiedPatch(patch: string) {
  const lines = patch.split("\n");
  const filePatches: Array<{ path: string; hunks: string[][]; insertions: number; deletions: number }> = [];
  let current: (typeof filePatches)[number] | undefined;
  let currentHunk: string[] | undefined;

  for (const line of lines) {
    if (line.startsWith("+++ ")) {
      current = { path: normalizeProjectPath(line.slice(4).trim()), hunks: [], insertions: 0, deletions: 0 };
      filePatches.push(current);
      currentHunk = undefined;
      continue;
    }
    if (!current) continue;
    if (line.startsWith("@@")) {
      currentHunk = [];
      current.hunks.push(currentHunk);
      continue;
    }
    if (!currentHunk) continue;
    currentHunk.push(line);
    if (line.startsWith("+") && !line.startsWith("+++")) current.insertions += 1;
    if (line.startsWith("-") && !line.startsWith("---")) current.deletions += 1;
  }

  return filePatches;
}

function applyHunks(oldContent: string, hunks: string[][]) {
  let nextLines = oldContent ? oldContent.split("\n") : [];
  for (const hunk of hunks) {
    const context = hunk.filter((line) => line.startsWith(" ")).map((line) => line.slice(1));
    const startIndex = context.length > 0 ? findContext(nextLines, context) : 0;
    if (startIndex < 0) throw new ProjectPatchPolicyError("PATCH_APPLY_FAILED", "Patch context did not match the target file.");
    const replacement = hunk.filter((line) => !line.startsWith("-")).map((line) => line.startsWith("+") || line.startsWith(" ") ? line.slice(1) : line);
    const removeCount = hunk.filter((line) => !line.startsWith("+")).length;
    nextLines = [...nextLines.slice(0, startIndex), ...replacement, ...nextLines.slice(startIndex + removeCount)];
  }
  return nextLines.join("\n");
}

function findContext(lines: string[], context: string[]) {
  for (let index = 0; index <= lines.length - context.length; index += 1) {
    if (context.every((line, offset) => lines[index + offset] === line)) return index;
  }
  return -1;
}

async function fileExists(filePath: string) {
  try { await stat(filePath); return true; } catch { return false; }
}

async function diffDirectories(_baselineRoot: string, _workspaceRoot: string) {
  return [] as string[];
}
