import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export const TASTE_SKILL_RELATIVE_PATH =
  ".agents/skills/design-taste-frontend/SKILL.md";

export type TasteSkill = {
  content: string;
  hash: string;
};

type CacheEntry = {
  mtimeMs: number;
  skill: TasteSkill;
};

let cache: CacheEntry | null = null;

function resolveTasteSkillPath(): string {
  // The skill lives in the Builder repo, NOT in a generated project workspace.
  // process.cwd() is the Builder application root (same anchor paths.server uses).
  return path.resolve(process.cwd(), TASTE_SKILL_RELATIVE_PATH);
}

/**
 * Load the design-taste-frontend SKILL.md from disk. The skill is the live source of
 * truth for storefront UI taste — editing the file changes agent behavior with no code
 * change. Cached by mtime so repeated reads in one process are cheap.
 *
 * Throws if the file cannot be read: the skill is a required runtime dependency
 * (it is git-tracked and shipped), so a missing/unreadable skill must fail the turn
 * rather than silently degrade to slop.
 */
export async function loadTasteSkill(): Promise<TasteSkill> {
  const skillPath = resolveTasteSkillPath();

  let mtimeMs: number;
  try {
    const stats = await stat(skillPath);
    mtimeMs = stats.mtimeMs;
  } catch (error) {
    throw new Error(
      `Taste skill not found at ${skillPath}. The design-taste-frontend SKILL.md is a required runtime dependency. Original error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (cache && cache.mtimeMs === mtimeMs) {
    return cache.skill;
  }

  let content: string;
  try {
    content = await readFile(skillPath, "utf8");
  } catch (error) {
    throw new Error(
      `Failed to read taste skill at ${skillPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!content.trim()) {
    throw new Error(`Taste skill at ${skillPath} is empty.`);
  }

  const skill: TasteSkill = {
    content,
    hash: createHash("sha256").update(content).digest("hex"),
  };
  cache = { mtimeMs, skill };
  return skill;
}

/**
 * Extract the sections relevant to dial inference (Design Read + dials) so the
 * server-side dials step can embed just those instead of the full 85KB skill.
 * Pulls sections 0 (BRIEF INFERENCE), 1 (THE THREE DIALS), and 7 (DIAL DEFINITIONS).
 * Falls back to the whole document if the expected headers are not found.
 */
export function extractDialInferenceSection(content: string): string {
  const wanted = [
    /^##\s+0\.\s+BRIEF INFERENCE/im,
    /^##\s+1\.\s+THE THREE DIALS/im,
    /^##\s+7\.\s+DIAL DEFINITIONS/im,
  ];
  // Split on level-2 headers, keeping each section with its heading.
  const parts = content.split(/(?=^##\s+)/m);
  const matched = parts.filter((part) => wanted.some((re) => re.test(part)));
  if (matched.length === 0) return content;
  return matched.join("\n").trim();
}
