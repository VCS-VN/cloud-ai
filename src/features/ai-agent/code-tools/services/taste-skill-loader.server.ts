import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export const TASTE_SKILL_RELATIVE_PATH =
  ".agents/skills/design-taste-frontend/SKILL.md";

const TASTE_SKILL_REMOTE_URL =
  "https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md";

export type TasteSkill = {
  content: string;
  hash: string;
};

let remoteCache: TasteSkill | null = null;

function resolveTasteSkillPath(): string {
  // The skill lives in the Builder repo, NOT in a generated project workspace.
  // process.cwd() is the Builder application root (same anchor paths.server uses).
  return path.resolve(process.cwd(), TASTE_SKILL_RELATIVE_PATH);
}

function hashContent(content: string): TasteSkill {
  return {
    content,
    hash: createHash("sha256").update(content).digest("hex"),
  };
}

/**
 * Load the design-taste-frontend SKILL.md. The skill is the live source of truth for
 * storefront UI taste — editing the file changes agent behavior with no code change.
 *
 * Fetches the skill from the canonical remote (TASTE_SKILL_REMOTE_URL) once at boot and
 * caches it for the whole process. If the remote is unreachable (network error, timeout,
 * non-200, empty body), falls back to the git-tracked local copy on disk.
 *
 * Throws if BOTH remote and local fail: the skill is a required runtime dependency, so a
 * totally broken setup must fail the turn rather than silently degrade to slop.
 */
export async function loadTasteSkill(): Promise<TasteSkill> {
  if (remoteCache) {
    return remoteCache;
  }

  try {
    const res = await fetch(TASTE_SKILL_REMOTE_URL, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const content = await res.text();
    if (!content.trim()) {
      throw new Error("remote body was empty");
    }
    remoteCache = hashContent(content);
    return remoteCache;
  } catch (error) {
    console.warn(
      `Failed to fetch taste skill from ${TASTE_SKILL_REMOTE_URL}, falling back to local file: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const skillPath = resolveTasteSkillPath();

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

  remoteCache = hashContent(content);
  return remoteCache;
}
