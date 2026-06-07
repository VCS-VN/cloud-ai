import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  parseFrontmatter,
  type FrontmatterParseResult,
  type SkillMeta,
} from "./frontmatter-parser";

export const TRUNCATION_MARKER = "\n\n... [truncated by skill loader] ...";

export type LoadedSkill = {
  meta: SkillMeta;
  body: string;
  hash: string;
  truncated: boolean;
};

export type SkillLoadFailureReason =
  | "file_not_found"
  | "name_dir_mismatch"
  | "missing_frontmatter"
  | "invalid_yaml"
  | "schema_violation"
  | "unknown_fields";

export type SkillLoadResult =
  | { ok: true; skill: LoadedSkill }
  | { ok: false; reason: SkillLoadFailureReason; detail?: string };

function truncate(body: string, maxChars: number): { body: string; truncated: boolean } {
  if (body.length <= maxChars) return { body, truncated: false };
  return {
    body: body.slice(0, maxChars - TRUNCATION_MARKER.length) + TRUNCATION_MARKER,
    truncated: true,
  };
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function reasonFromParse(result: Extract<FrontmatterParseResult, { ok: false }>): SkillLoadFailureReason {
  return result.reason;
}

export async function loadSkill(input: {
  directoryPath: string;
  maxSkillChars: number;
}): Promise<SkillLoadResult> {
  const target = path.join(input.directoryPath, "SKILL.md");
  let content: string;
  try {
    content = await fs.readFile(target, "utf8");
  } catch {
    return { ok: false, reason: "file_not_found" };
  }
  const parsed = parseFrontmatter(content);
  if (!parsed.ok) {
    return { ok: false, reason: reasonFromParse(parsed), detail: parsed.detail };
  }

  const expectedName = path.basename(input.directoryPath);
  if (parsed.meta.name !== expectedName) {
    return {
      ok: false,
      reason: "name_dir_mismatch",
      detail: `frontmatter name=${parsed.meta.name} but directory=${expectedName}`,
    };
  }

  const { body, truncated } = truncate(parsed.body, input.maxSkillChars);
  const hash = sha256(body);
  return {
    ok: true,
    skill: { meta: parsed.meta, body, hash, truncated },
  };
}
