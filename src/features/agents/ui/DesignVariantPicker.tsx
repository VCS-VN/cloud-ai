import { useState } from "react";
import type { DesignVariant } from "@/shared/project-types";

export type DesignVariantPickerProps = {
  variants: DesignVariant[];
  onSelect: (optionId: string) => Promise<void> | void;
  onCustom?: (freeText: string) => Promise<void> | void;
  disabled?: boolean;
};

/**
 * Design variant picker (T065). Renders four variants as visual-lite cards with
 * palette dots and a one-line description, plus an optional custom textarea
 * for users who want to give free-text guidance instead of picking a card.
 *
 * Privacy: descriptions are filtered server-side before they reach this UI;
 * this component never echoes paths or code.
 */
export function DesignVariantPicker({
  variants,
  onSelect,
  onCustom,
  disabled,
}: DesignVariantPickerProps) {
  const [customText, setCustomText] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  const handlePick = async (id: string) => {
    setSubmitting(id);
    try {
      await onSelect(id);
    } finally {
      setSubmitting(null);
    }
  };

  const handleCustomSubmit = async () => {
    if (!onCustom) return;
    const trimmed = customText.trim();
    if (!trimmed) return;
    setSubmitting("__custom");
    try {
      await onCustom(trimmed);
    } finally {
      setSubmitting(null);
    }
  };

  const isBusy = disabled || submitting !== null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {variants.map((variant) => (
          <button
            key={variant.id}
            type="button"
            disabled={isBusy}
            onClick={() => handlePick(variant.id)}
            className={`text-left rounded-md border border-app-border bg-app-surface hover:border-app-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus-ring p-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              submitting === variant.id ? "ring-2 ring-app-accent" : ""
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex gap-1">
                {variant.preview.palette.map((hex, idx) => (
                  <span
                    key={`${variant.id}-${idx}`}
                    className="inline-block h-4 w-4 rounded-full border border-app-border-soft"
                    style={{ backgroundColor: hex }}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <span className="font-medium text-sm text-app-fg">{variant.label}</span>
            </div>
            <p className="text-xs text-app-fg/80 leading-snug">{variant.description}</p>
          </button>
        ))}
      </div>
      {onCustom ? (
        <div className="space-y-2 pt-1">
          <label className="block text-xs text-app-fg/70" htmlFor="design-variant-custom">
            Hoặc mô tả phong cách bạn muốn
          </label>
          <textarea
            id="design-variant-custom"
            value={customText}
            disabled={isBusy}
            rows={2}
            onChange={(e) => setCustomText(e.target.value)}
            className="w-full rounded-md border border-app-border bg-app-surface text-sm text-app-fg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus-ring disabled:opacity-60"
            placeholder="Ví dụ: Tôi muốn tone cá tính, gam đậm và typography táo bạo."
          />
          <button
            type="button"
            disabled={isBusy || !customText.trim()}
            onClick={handleCustomSubmit}
            className="bg-app-accent text-app-on-accent hover:bg-app-accent-hover disabled:opacity-60 px-4 py-2 rounded-md text-sm"
          >
            {submitting === "__custom" ? "Đang áp dụng…" : "Dùng mô tả này"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
