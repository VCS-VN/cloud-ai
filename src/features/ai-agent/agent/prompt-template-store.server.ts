import { readFileSync } from "node:fs";
import path from "node:path";

const promptDocCache = new Map<string, string>();
const UNRESOLVED_PLACEHOLDER_RE = /{{[^}]+}}/;
const PLACEHOLDER_RE = /{{\s*([A-Za-z0-9_.-]+)\s*}}/g;

/**
 * Strip a leading YAML frontmatter block (--- ... ---) used to carry
 * human-facing warnings/metadata that must NOT reach the model. Everything
 * after the closing fence is the prompt body.
 */
export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content.trim();
  const end = content.indexOf("\n---", 3);
  if (end === -1) return content.trim();
  const afterFence = content.indexOf("\n", end + 1);
  if (afterFence === -1) return "";
  return content.slice(afterFence + 1).trim();
}

export function loadPromptDoc(relPath: string): string {
  const resolvedPath = path.resolve(process.cwd(), relPath);
  const cached = promptDocCache.get(resolvedPath);
  if (cached !== undefined) return cached;

  const raw = readFileSync(resolvedPath, "utf8");
  const body = stripFrontmatter(raw);
  promptDocCache.set(resolvedPath, body);
  return body;
}

export function renderPromptDoc(
  relPath: string,
  vars: Record<string, string>,
): string {
  const rendered = loadPromptDoc(relPath).replace(
    PLACEHOLDER_RE,
    (match, key: string) =>
      Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );

  if (UNRESOLVED_PLACEHOLDER_RE.test(rendered)) {
    console.warn(
      `[prompt-template] unresolved placeholder after rendering ${relPath}`,
    );
  }

  return rendered;
}
