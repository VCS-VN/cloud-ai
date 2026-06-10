import { BUILDER_RUN_LOCALE_EN } from "@/features/agents/ui/builder-run-i18n";
import type { SelectionPending } from "./selection.server";
import type { LoadedSkill } from "./skill-loader.server";

export type ClarificationOption = {
  id: string;
  label: string;
};

export type ClarificationPrompt = {
  question: string;
  options: ClarificationOption[];
};

export const MAX_CLARIFICATION_OPTIONS = 4;
export const MAX_OPTION_LABEL_CHARS = 80;

function truncateLabel(description: string): string {
  if (description.length <= MAX_OPTION_LABEL_CHARS) return description;
  const prefix = description.slice(0, MAX_OPTION_LABEL_CHARS);
  const lastWs = prefix.search(/\s\S*$/);
  if (lastWs > 0) {
    return `${prefix.slice(0, lastWs).trimEnd()}…`;
  }
  return `${prefix}…`;
}

export function buildClarificationPrompt(input: {
  candidates: SelectionPending[];
  registry: LoadedSkill[];
}): ClarificationPrompt {
  const { candidates, registry } = input;

  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  if (sorted.length > MAX_CLARIFICATION_OPTIONS) {
    const dropped = sorted
      .slice(MAX_CLARIFICATION_OPTIONS)
      .map((c) => c.name)
      .join(", ");
    console.warn(
      `[clarification] dropping ${sorted.length - MAX_CLARIFICATION_OPTIONS} overflow candidate(s): ${dropped}`,
    );
  }

  const top = sorted.slice(0, MAX_CLARIFICATION_OPTIONS);

  const options: ClarificationOption[] = top.map((candidate) => {
    const skill = registry.find((s) => s.meta.name === candidate.name);
    if (!skill) {
      console.warn(
        `[clarification] candidate "${candidate.name}" not found in registry; using name as label`,
      );
      return { id: candidate.name, label: candidate.name };
    }
    return {
      id: candidate.name,
      label: truncateLabel(skill.meta.description),
    };
  });

  return {
    question: BUILDER_RUN_LOCALE_EN.clarification.questionScaffold,
    options,
  };
}
