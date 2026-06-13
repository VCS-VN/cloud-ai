import fs from "node:fs/promises";
import path from "node:path";
import type { ValidationOutcome } from "./typecheck.server";

const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const IMPORT_RE = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
const EXPORT_RE = /\bexport\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)\b/g;
const EXPORT_LIST_RE = /\bexport\s+\{([^}]+)\}/g;

type SourceFile = {
  absolutePath: string;
  relativePath: string;
  content: string;
};

function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

async function listSourceFiles(root: string): Promise<SourceFile[]> {
  const srcRoot = path.join(root, "src");
  const files: SourceFile[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        await walk(full);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
        files.push({
          absolutePath: full,
          relativePath: path.relative(root, full),
          content: await fs.readFile(full, "utf8"),
        });
      }
    }
  }
  await walk(srcRoot);
  return files;
}

function resolveLocalImport(fromFile: SourceFile, specifier: string, root: string): string | null {
  if (specifier.startsWith("@/")) {
    return path.join(root, "src", specifier.slice(2));
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return path.resolve(path.dirname(fromFile.absolutePath), specifier);
  }
  return null;
}

async function resolveSourceFile(basePath: string): Promise<string | null> {
  const candidates = [
    basePath,
    ...SOURCE_EXTENSIONS.map((ext) => `${basePath}${ext}`),
    ...SOURCE_EXTENSIONS.map((ext) => path.join(basePath, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function parseNamedImports(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(/\s+as\s+/i)[0]?.trim())
    .filter((name): name is string => Boolean(name) && name !== "type");
}

function parseExports(content: string): Set<string> {
  const clean = stripComments(content);
  const exports = new Set<string>();
  for (const match of clean.matchAll(EXPORT_RE)) {
    exports.add(match[1]);
  }
  for (const match of clean.matchAll(EXPORT_LIST_RE)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/i).pop()?.trim();
      if (name && name !== "default") exports.add(name);
    }
  }
  return exports;
}

export async function runNamedExportContract(
  draftWorkspacePath: string,
): Promise<ValidationOutcome> {
  const startedAt = Date.now();
  const files = await listSourceFiles(draftWorkspacePath);
  const byPath = new Map(files.map((file) => [file.absolutePath, file]));
  const failures: string[] = [];

  for (const file of files) {
    const clean = stripComments(file.content);
    for (const match of clean.matchAll(IMPORT_RE)) {
      const importedNames = parseNamedImports(match[1]);
      const basePath = resolveLocalImport(file, match[2], draftWorkspacePath);
      if (!basePath || importedNames.length === 0) continue;
      const resolved = await resolveSourceFile(basePath);
      if (!resolved) continue;
      const target = byPath.get(resolved) ?? {
        absolutePath: resolved,
        relativePath: path.relative(draftWorkspacePath, resolved),
        content: await fs.readFile(resolved, "utf8"),
      };
      const exports = parseExports(target.content);
      for (const importedName of importedNames) {
        if (!exports.has(importedName)) {
          failures.push(
            `${file.relativePath} imports { ${importedName} } from ${match[2]}, but ${target.relativePath} does not export ${importedName}`,
          );
        }
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  if (failures.length === 0) return { ok: true, durationMs };
  return {
    ok: false,
    durationMs,
    summary: failures.slice(0, 20).join("\n"),
    errorCount: failures.length,
  };
}
