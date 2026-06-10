import { useState, type FormEvent } from "react";
import { ArrowRight, FileCode, Image, Link2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type HomePromptFormProps = {
  prompt: string;
  loading?: boolean;
  error?: string;
  onPromptChange: (prompt: string) => void;
  onSubmit: (prompt: string) => Promise<void> | void;
};

const placeholders = [
  "Example: Landing page for an AI English learning app. Hero with demo, 3 features, pricing, CTA.",
  "Example: Handmade storefront with 24 SKUs and Stripe checkout sandbox.",
];

const ATTACHMENTS: Array<{ key: string; label: string; Icon: typeof Image }> = [
  { key: "image", label: "Image", Icon: Image },
  { key: "url", label: "URL", Icon: Link2 },
  { key: "brand", label: "Brand", Icon: Sparkles },
  { key: "figma", label: "Figma", Icon: FileCode },
];

export function HomePromptForm({
  prompt,
  loading = false,
  error,
  onPromptChange,
  onSubmit,
}: HomePromptFormProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const canSubmit = prompt.trim().length > 0 && !loading;
  const placeholder = placeholders[placeholderIndex];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    await onSubmit(prompt);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  }

  function handleAnimationIteration() {
    setPlaceholderIndex((current) =>
      current === placeholders.length - 1 ? 0 : current + 1,
    );
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="project-prompt">
        Describe what you want to build
      </label>
      <Textarea
        id="project-prompt"
        className="composer-textarea"
        value={prompt}
        placeholder={placeholder}
        disabled={loading}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onAnimationIteration={handleAnimationIteration}
      />

      <div className="border-t border-hairline/60 pt-2">
        <div className="composer-row">
          <div className="composer-attach">
            {ATTACHMENTS.map(({ key, label, Icon }) => (
              <Button
                key={key}
                variant="unstyled"
                className="composer-attach-btn"
                aria-label={label}
                title={`${label} — coming soon`}
                disabled
              >
                <Icon aria-hidden="true" size={14} />
                <span>{label}</span>
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden font-mono text-eyebrow text-subtle sm:inline">
              ⌘ + ↵
            </span>
            <Button
              variant="default"
              type="submit"
              disabled={!canSubmit}
              aria-label={loading ? "Building project..." : "Build project"}
              aria-busy={loading}
            >
              {loading ? "Building..." : "Start build"}
              <ArrowRight aria-hidden="true" size={14} />
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <p
          className="mt-2 rounded-input border border-hairline bg-danger-bg p-3 text-ui-sm text-danger-fg"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {loading ? "Creating your project and preparing the workspace." : ""}
      </p>
    </form>
  );
}
