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

export async function loadInstruction(input: {
  name: string;
  relativePath: string;
  source: InstructionSource;
  version?: string;
}): Promise<LoadedInstruction> {
  const abs = resolveTemplatePath(input.relativePath);
  const raw = await fs.readFile(abs, "utf8");
  const stripped = frontmatterStrip(raw);
  const hash = createHash("sha256").update(stripped).digest("hex").slice(0, 16);
  const meta: SelectedInstruction = {
    name: input.name,
    source: input.source,
    version: input.version ?? "1.0.0",
    hash,
    loaded: true,
  };
  return { meta, content: stripped };
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
