import { useState } from "react";

export type SkillClarificationOption = {
  id: string;
  label: string;
};

export type SkillClarificationListProps = {
  question?: string;
  options: SkillClarificationOption[];
  onSelect: (optionId: string) => Promise<void> | void;
  disabled?: boolean;
};

/**
 * Skill clarification list (T068). Visually distinct from DesignVariantPicker
 * — a flat radio list (label only, no swatches, no descriptions). One click
 * resolves the choice.
 */
export function SkillClarificationList({
  question,
  options,
  onSelect,
  disabled,
}: SkillClarificationListProps) {
  const [submitting, setSubmitting] = useState<string | null>(null);

  const handlePick = async (id: string) => {
    setSubmitting(id);
    try {
      await onSelect(id);
    } finally {
      setSubmitting(null);
    }
  };

  const isBusy = disabled || submitting !== null;

  return (
    <div className="space-y-2">
      {question ? (
        <p className="text-sm text-app-fg/90">{question}</p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handlePick(option.id)}
              className={`w-full text-left rounded-md border border-app-border bg-app-surface hover:border-app-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus-ring px-3 py-2 text-sm text-app-fg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                submitting === option.id ? "ring-2 ring-app-accent" : ""
              }`}
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
