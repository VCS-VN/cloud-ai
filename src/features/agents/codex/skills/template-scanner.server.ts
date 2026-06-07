import { promises as fs } from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

export type TemplateScanResult = {
  templatePath: string;
  requiredSkills: string[];
  recommendedSkills: string[];
};

const SKILL_NAME_RE = /^[a-z][a-z0-9-]*$/;
const INLINE_DIRECTIVE_RE =
  /^@skill:([a-z][a-z0-9-]+)\s+(required|recommended)\s*$/;
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

const TEMPLATES_ROOT = "templates/codex-builder";

const SINGLE_FILE_TARGETS = [
  `${TEMPLATES_ROOT}/foundation/edit-system.md`,
  `${TEMPLATES_ROOT}/init/system.md`,
];

const GLOB_DIR_TARGETS = [
  `${TEMPLATES_ROOT}/recovery`,
  `${TEMPLATES_ROOT}/redesign`,
];

function resolveAbs(rel: string): string {
  return path.resolve(process.cwd(), rel);
}

async function listMarkdownFiles(absDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(absDir);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(absDir, name));
}

function extractFrontmatter(content: string): {
  required: string[];
  recommended: string[];
} {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return { required: [], recommended: [] };

  let parsed: unknown;
  try {
    parsed = yaml.load(match[1]);
  } catch (err) {
    console.warn(
      `[template-scanner] frontmatter parse error; ignoring frontmatter: ${
        (err as Error).message
      }`,
    );
    return { required: [], recommended: [] };
  }

  if (!parsed || typeof parsed !== "object") {
    return { required: [], recommended: [] };
  }

  const data = parsed as Record<string, unknown>;
  return {
    required: collectSkillArray(data.requiredSkills, "requiredSkills"),
    recommended: collectSkillArray(data.recommendedSkills, "recommendedSkills"),
  };
}

function collectSkillArray(value: unknown, fieldName: string): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    console.warn(
      `[template-scanner] ${fieldName} is not an array; ignoring`,
    );
    return [];
  }
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      console.warn(
        `[template-scanner] ${fieldName} entry is not a string; skipping`,
      );
      continue;
    }
    if (!SKILL_NAME_RE.test(entry)) {
      console.warn(
        `[template-scanner] invalid skill name "${entry}" in ${fieldName}; skipping`,
      );
      continue;
    }
    out.push(entry);
  }
  return out;
}

function extractInlineDirectives(content: string): {
  required: string[];
  recommended: string[];
} {
  const required: string[] = [];
  const recommended: string[] = [];

  const body = content.replace(FRONTMATTER_RE, "");
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine;
    if (!line.startsWith("@skill:")) continue;
    const m = line.match(INLINE_DIRECTIVE_RE);
    if (!m) {
      console.warn(
        `[template-scanner] malformed inline @skill directive; skipping: "${line}"`,
      );
      continue;
    }
    const [, name, level] = m;
    if (!SKILL_NAME_RE.test(name)) {
      console.warn(
        `[template-scanner] invalid skill name "${name}" in inline directive; skipping`,
      );
      continue;
    }
    if (level === "required") required.push(name);
    else recommended.push(name);
  }

  return { required, recommended };
}

async function scanFile(absPath: string): Promise<TemplateScanResult | null> {
  let content: string;
  try {
    content = await fs.readFile(absPath, "utf8");
  } catch {
    return null;
  }

  const fm = extractFrontmatter(content);
  const inline = extractInlineDirectives(content);

  // Frontmatter takes precedence: a name in frontmatter.required overrides
  // any inline recommended for the same name within this template.
  const requiredSet = new Set<string>([...fm.required, ...inline.required]);
  const recommendedSet = new Set<string>();
  for (const name of [...fm.recommended, ...inline.recommended]) {
    if (!requiredSet.has(name)) recommendedSet.add(name);
  }

  return {
    templatePath: absPath,
    requiredSkills: Array.from(requiredSet),
    recommendedSkills: Array.from(recommendedSet),
  };
}

export async function scanActiveTemplates(): Promise<TemplateScanResult[]> {
  const targets: string[] = SINGLE_FILE_TARGETS.map(resolveAbs);

  for (const dirRel of GLOB_DIR_TARGETS) {
    const dirAbs = resolveAbs(dirRel);
    const files = await listMarkdownFiles(dirAbs);
    targets.push(...files);
  }

  const results: TemplateScanResult[] = [];
  for (const abs of targets) {
    const r = await scanFile(abs);
    if (r) results.push(r);
  }
  return results;
}

export function aggregateTemplateScans(results: TemplateScanResult[]): {
  required: Set<string>;
  recommended: Set<string>;
} {
  const required = new Set<string>();
  const recommended = new Set<string>();

  for (const r of results) {
    for (const name of r.requiredSkills) required.add(name);
  }
  for (const r of results) {
    for (const name of r.recommendedSkills) {
      if (!required.has(name)) recommended.add(name);
    }
  }

  return { required, recommended };
}
