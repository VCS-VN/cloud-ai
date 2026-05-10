import { Loader2, Play } from "lucide-react";
import { useState, type ReactNode } from "react";

type PreviewInitPanelProps = {
  projectId: string;
  onStartPreview: () => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

export function PreviewInitPanel({
  projectId,
  onStartPreview,
  isLoading = false,
  error = null,
  onRetry,
}: PreviewInitPanelProps) {
  const [isStarting, setIsStarting] = useState(false);

  const handleStartClick = () => {
    if (isStarting || isLoading) return;
    setIsStarting(true);
    onStartPreview();
  };

  if (isLoading || isStarting) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-md bg-[var(--app-panel)] p-md transition-colors duration-300">
        <Loader2
          aria-hidden="true"
          className="animate-spin text-[var(--app-icon-muted)]"
          size={32}
        />
        <p className="text-[14px] leading-4 text-[var(--app-muted)]">
          Initializing preview...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--app-panel)] p-md transition-colors duration-300">
        <div className="max-w-sm rounded-md border border-[var(--app-border-strong)] bg-[var(--app-danger-bg)] p-md">
          <p className="text-[var(--app-danger-text)] text-[14px] leading-4">
            {error}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-sm inline-flex items-center gap-xs rounded-pill bg-[var(--app-control)] px-md py-xs text-[14px] font-[480] text-[var(--app-text)] transition-colors duration-300 hover:bg-[var(--app-surface)]"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-lg bg-[var(--app-panel)] p-md transition-colors duration-300">
      <div className="flex flex-col items-center gap-sm text-center">
        <p className="text-[14px] leading-4 text-[var(--app-muted)]">
          Preview is not running
        </p>
        <button
          type="button"
          onClick={handleStartClick}
          className="inline-flex items-center gap-xs rounded-pill bg-[var(--app-control)] px-lg py-xs text-[14px] font-[480] text-[var(--app-text)] transition-colors duration-300 hover:bg-[var(--app-surface)]"
        >
          <Play aria-hidden="true" size={16} />
          Start Preview
        </button>
      </div>
    </div>
  );
}