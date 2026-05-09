import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { guardProjectPath, isForbiddenProjectPath } from "./project-path-guard.server";
import { redactSecrets } from "./secret-redaction.server";

const DEFAULT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".md"]);

export async function searchProjectCode(input: { workspaceRoot: string; query: string; globs?: string[]; maxResults?: number }) {
  const query = input.query.trim().toLowerCase();
  if (!query) return { ok: false as const, error: { code: "EMPTY_QUERY", message: "Search query is required." } };

  const maxResults = Math.min(Math.max(input.maxResults ?? 12, 1), 30);
  const files = await collectFiles(input.workspaceRoot, "", input.globs ?? []);
  const matches: Array<{ path: string; line: number; snippet: string }> = [];

  for (const filePath of files) {
    if (matches.length >= maxResults) break;
    const content = await readFile(join(input.workspaceRoot, filePath), "utf8");
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length && matches.length < maxResults; index += 1) {
      if (lines[index]?.toLowerCase().includes(query)) {
        matches.push({ path: filePath, line: index + 1, snippet: redactSecrets(lines[index]!.trim()).slice(0, 500) });
      }
    }
  }

  return { ok: true as const, data: { query: input.query, matches, truncated: matches.length >= maxResults } };
}

async function collectFiles(workspaceRoot: string, root: string, globs: string[]): Promise<string[]> {
  const guarded = guardProjectPath({ workspaceRoot, path: root });
  if (!guarded.ok) return [];

  const entries = await readdir(guarded.absolutePath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = relative(workspaceRoot, join(guarded.absolutePath, entry.name)).replaceAll("\\", "/");
    if (isForbiddenProjectPath(relativePath)) continue;
    if (entry.isDirectory()) files.push(...(await collectFiles(workspaceRoot, relativePath, globs)));
    if (entry.isFile() && shouldIncludeFile(relativePath, globs)) files.push(relativePath);
  }

  return files;
}

function shouldIncludeFile(path: string, globs: string[]) {
  if (globs.length === 0) return DEFAULT_EXTENSIONS.has(extensionOf(path));
  return globs.some((glob) => globMatches(path, glob));
}

function globMatches(path: string, glob: string) {
  if (glob.includes("*.tsx") && path.endsWith(".tsx")) return true;
  if (glob.includes("*.ts") && path.endsWith(".ts")) return true;
  if (glob.includes("*.jsx") && path.endsWith(".jsx")) return true;
  if (glob.includes("*.js") && path.endsWith(".js")) return true;
  return path.includes(glob.replaceAll("*", ""));
}

function extensionOf(path: string) {
  const match = /\.[^.\/]+$/.exec(path);
  return match?.[0] ?? "";
}
