import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type InstructionSource =
  | "template_required"
  | "template_recommended"
  | "explicit_user"
  | "detected";

export type SelectedInstruction = {
  name: string;
  source: InstructionSource;
  version: string;
  hash: string;
  loaded: true;
};

export type LoadedInstruction = {
  meta: SelectedInstruction;
  content: string;
};

const TEMPLATES_ROOT_RELATIVE = "templates/codex-builder";

function resolveTemplatePath(relPath: string): string {
  return path.resolve(process.cwd(), TEMPLATES_ROOT_RELATIVE, relPath);
}

function frontmatterStrip(content: string): string {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---", 4);
  if (end === -1) return content;
  return content.slice(end + 4).replace(/^\n+/, "");
}

// {{include:<rel-path>}} placeholder resolver. Inlines the body of another
// template (frontmatter stripped) at the placeholder's location so we can keep
// one canonical copy of rules that used to be duplicated across 3-5 prompt
// files. Path is resolved relative to `templates/codex-builder/`.
//
// Constraints:
// - One pass only (depth 1). The resolved body is NOT re-scanned for nested
//   {{include:...}} — a canonical file MUST be a leaf to keep prompts auditable
//   and prevent accidental cycles. Nested placeholders are left as-is and will
//   surface in the prompt as a visible bug (the dev sees the unresolved token).
// - Missing target file → leave placeholder verbatim + warn. A typo must not
//   silently empty a section of the prompt.
const INCLUDE_RE = /\{\{include:([a-zA-Z0-9_\-./]+)\}\}/g;

async function resolveIncludes(body: string): Promise<string> {
  const matches = Array.from(body.matchAll(INCLUDE_RE));
  if (matches.length === 0) return body;
  const cache = new Map<string, string>();
  let out = body;
  for (const match of matches) {
    const placeholder = match[0];
    const rel = match[1];
    if (!rel) continue;
    let resolved = cache.get(rel);
    if (resolved === undefined) {
      try {
        const abs = resolveTemplatePath(rel);
        const raw = await fs.readFile(abs, "utf8");
        resolved = frontmatterStrip(raw).trim();
        cache.set(rel, resolved);
      } catch (error) {
        console.warn(
          `[instruction-loader] include "${rel}" failed: ${
            error instanceof Error ? error.message : "unknown"
          }`,
        );
        continue;
      }
    }
    out = out.split(placeholder).join(resolved);
  }
  return out;
}

// Exposed for other prompt-assembly paths (project-rules loader, batch-spec
// loader) that read MD outside `loadInstruction` but still want canonical
// dedupe placeholders to resolve.
export async function resolveTemplateIncludes(body: string): Promise<string> {
  return resolveIncludes(body);
}

export async function loadInstruction(input: {
  name: string;
  relativePath: string;
  source: InstructionSource;
  version?: string;
}): Promise<LoadedInstruction> {
  const abs = resolveTemplatePath(input.relativePath);
  const raw = await fs.readFile(abs, "utf8");
  const stripped = frontmatterStrip(raw);
  const expanded = await resolveIncludes(stripped);
  const hash = createHash("sha256").update(expanded).digest("hex").slice(0, 16);
  const meta: SelectedInstruction = {
    name: input.name,
    source: input.source,
    version: input.version ?? "1.0.0",
    hash,
    loaded: true,
  };
  return { meta, content: expanded };
}

export function wrapSelectedInstruction(input: {
  meta: SelectedInstruction;
  content: string;
}): string {
  const attrs = [
    `name="${input.meta.name}"`,
    `source="${input.meta.source}"`,
    `version="${input.meta.version}"`,
    `hash="${input.meta.hash}"`,
  ].join(" ");
  return `<selected_instruction ${attrs}>\n${input.content.trim()}\n</selected_instruction>`;
}

export const INSTRUCTION_TEMPLATES_ROOT = TEMPLATES_ROOT_RELATIVE;
