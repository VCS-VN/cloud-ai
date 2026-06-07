import yaml from "js-yaml";
import { z } from "zod";

export type SkillMeta = {
  name: string;
  description: string;
  aliases: string[];
  triggers: string[];
  asksClarification: boolean;
  clarificationPolicy: "never" | "when_ambiguous" | "always_before_apply";
  appliesTo: string[];
  version: string;
};

export type FrontmatterParseResult =
  | { ok: true; meta: SkillMeta; body: string }
  | {
      ok: false;
      reason:
        | "missing_frontmatter"
        | "invalid_yaml"
        | "schema_violation"
        | "unknown_fields";
      detail?: string;
    };

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

const ALLOWED_KEYS = new Set([
  "name",
  "description",
  "aliases",
  "triggers",
  "asksClarification",
  "clarificationPolicy",
  "appliesTo",
  "version",
]);

const skillMetaSchema = z
  .object({
    name: z
      .string()
      .regex(
        NAME_PATTERN,
        "name must match ^[a-z][a-z0-9-]*$ (lowercase letters, digits, hyphens; leading letter)",
      ),
    description: z.string(),
    aliases: z.array(z.string()).default([]),
    triggers: z.array(z.string()).default([]),
    asksClarification: z.boolean().default(false),
    clarificationPolicy: z
      .enum(["never", "when_ambiguous", "always_before_apply"])
      .default("never"),
    appliesTo: z.array(z.string()).default([]),
    version: z.string().default("1.0.0"),
  })
  .strict();

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(content: string): FrontmatterParseResult {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { ok: false, reason: "missing_frontmatter" };
  }

  const yamlSource = match[1] ?? "";
  const body = content.slice(match[0].length);

  let raw: unknown;
  try {
    raw = yaml.load(yamlSource);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "invalid_yaml", detail };
  }

  if (raw === null || raw === undefined) {
    return {
      ok: false,
      reason: "schema_violation",
      detail: "frontmatter is empty",
    };
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      reason: "schema_violation",
      detail: "frontmatter must be a YAML mapping",
    };
  }

  const unknown = Object.keys(raw as Record<string, unknown>).filter(
    (k) => !ALLOWED_KEYS.has(k),
  );
  if (unknown.length > 0) {
    return {
      ok: false,
      reason: "unknown_fields",
      detail: `unknown field(s): ${unknown.join(", ")}`,
    };
  }

  const parsed = skillMetaSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
        return `${path}: ${issue.message}`;
      })
      .join("; ");
    return { ok: false, reason: "schema_violation", detail };
  }

  return { ok: true, meta: parsed.data, body };
}
