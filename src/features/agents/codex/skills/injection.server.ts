import type { LoadedSkill } from "@/features/agents/codex/skills/skill-loader.server";

export type SelectedSkillSource =
  | "template_required"
  | "template_recommended"
  | "explicit_user"
  | "detected";

export type SelectedSkillForInjection = {
  name: string;
  score: number;
  source: SelectedSkillSource;
};

export type WrapSelectedSkillInput = {
  meta: LoadedSkill["meta"];
  body: string;
  hash: string;
  source: SelectedSkillSource;
  score: number;
};

const CLOSING_TAG = "</selected_skill>";

function sanitizeBody(body: string, skillName: string): string {
  if (!body.includes(CLOSING_TAG)) return body;
  console.warn(
    `[skills/injection] Skill "${skillName}" body contained literal "${CLOSING_TAG}"; stripping to preserve wrapper boundary.`,
  );
  return body.split(CLOSING_TAG).join("");
}

export function wrapSelectedSkill(input: WrapSelectedSkillInput): string {
  const safeBody = sanitizeBody(input.body, input.meta.name);
  const attrs = [
    `name="${input.meta.name}"`,
    `version="${input.meta.version}"`,
    `hash="${input.hash}"`,
    `source="${input.source}"`,
    `score="${Math.trunc(input.score)}"`,
  ].join(" ");
  return `<selected_skill ${attrs}>\n${safeBody}\n</selected_skill>`;
}

type Resolved = {
  entry: SelectedSkillForInjection;
  skill: LoadedSkill;
};

function compareByName(a: Resolved, b: Resolved): number {
  return a.skill.meta.name.localeCompare(b.skill.meta.name);
}

export function buildSelectedSkillBlocks(input: {
  selected: SelectedSkillForInjection[];
  registry: LoadedSkill[];
}): string[] {
  if (input.selected.length === 0) return [];

  const byName = new Map<string, LoadedSkill>();
  for (const skill of input.registry) {
    byName.set(skill.meta.name, skill);
  }

  const required: Resolved[] = [];
  const explicit: Resolved[] = [];
  const remaining: Resolved[] = [];

  for (const entry of input.selected) {
    const skill = byName.get(entry.name);
    if (!skill) {
      console.warn(
        `[skills/injection] Selected skill "${entry.name}" not found in registry; skipping.`,
      );
      continue;
    }
    const resolved: Resolved = { entry, skill };
    switch (entry.source) {
      case "template_required":
        required.push(resolved);
        break;
      case "explicit_user":
        explicit.push(resolved);
        break;
      case "template_recommended":
      case "detected":
        remaining.push(resolved);
        break;
    }
  }

  required.sort(compareByName);
  remaining.sort((a, b) => {
    if (b.entry.score !== a.entry.score) return b.entry.score - a.entry.score;
    return compareByName(a, b);
  });

  const ordered = [...required, ...explicit, ...remaining];

  return ordered.map((r) =>
    wrapSelectedSkill({
      meta: r.skill.meta,
      body: r.skill.body,
      hash: r.skill.hash,
      source: r.entry.source,
      score: r.entry.score,
    }),
  );
}
