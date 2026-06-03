import type { TasteSkill } from "./taste-skill-loader.server";

/** Max chars injected at init so the model has taste rules without a tool round-trip. */
export const INIT_TASTE_SKILL_PRELOAD_MAX_CHARS = 28_000;

export function buildPreloadedTasteSkillDeveloperMessage(skill: TasteSkill): string {
  const truncated = skill.content.length > INIT_TASTE_SKILL_PRELOAD_MAX_CHARS;
  const body = truncated
    ? `${skill.content.slice(0, INIT_TASTE_SKILL_PRELOAD_MAX_CHARS)}\n\n[... taste skill truncated for context size; call project_read_taste_skill for the full document ...]`
    : skill.content;

  return [
    "PRELOADED TASTE SKILL (design-taste-frontend) — authoritative for this init run.",
    `sha256: ${skill.hash}`,
    "The Builder preloaded this skill server-side. You MUST apply Section 0 (Brief Inference / Design Read) and all retail-relevant anti-slop rules when authoring DESIGN.md and storefront UI.",
    "You may still call project_read_taste_skill to reload the full document; tasteSkillLoaded is already true for this run.",
    "",
    body,
  ].join("\n");
}
