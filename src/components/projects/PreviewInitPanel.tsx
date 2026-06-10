import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type PreviewInitPanelProps = {
  projectId: string;
  onStartPreview: () => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

export function PreviewInitPanel({
  projectId: _projectId,
  onStartPreview,
  isLoading = false,
  error = null,
  onRetry,
}: PreviewInitPanelProps) {
  const handleStartClick = () => {
    if (isLoading) return;
    onStartPreview();
  };

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        className="flex h-full flex-col items-center justify-center gap-4 bg-paper p-6 transition-colors duration-300"
      >
        <Loader2
          aria-hidden="true"
          className="animate-spin text-muted"
          size={32}
        />
        <p className="text-sm leading-5 text-muted">
          Starting preview in the review panel...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-paper p-6 transition-colors duration-300">
        <div className="max-w-sm rounded-xl border border-hairline bg-danger-bg p-5 text-center">
          <p className="mb-1 text-[13px] font-semibold leading-5 text-danger-fg">
            Preview failed
          </p>
          <p className="text-sm leading-5 text-danger-fg">
            {error}
          </p>
          {onRetry && (
            <Button
              variant="unstyled"
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-8 items-center gap-1 rounded-md border border-hairline bg-surface px-3 text-xs font-medium text-ink transition-colors duration-base hover:bg-paper"
            >
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-paper p-6 transition-colors duration-300">
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-hairline bg-surface p-6 text-center shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-chalk text-ink">
          <Play aria-hidden="true" size={18} />
        </span>
        <div>
          <p className="m-0 text-[13px] font-semibold leading-5 text-ink">
            Preview is stopped
          </p>
          <p className="m-0 mt-1 text-xs leading-5 text-muted">
            Start runtime to view storefront output.
          </p>
        </div>
        <Button
          variant="unstyled"
          type="button"
          onClick={handleStartClick}
          disabled={isLoading}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-4 text-xs font-semibold text-paper transition-all duration-base hover:bg-deep active:translate-y-px disabled:opacity-40"
        >
          Start preview
        </Button>
      </div>
    </div>
  );
}
