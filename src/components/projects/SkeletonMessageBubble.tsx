import { Loader2 } from "lucide-react";
import type { SkeletonState } from "@/shared/project-types";

type SkeletonMessageBubbleProps = {
  skeleton: SkeletonState;
};

/**
 * Ephemeral "agent is working" bubble shown at the bottom of the list while a
 * run is active. Never persisted; cleared when the run reaches a terminal event.
 * Not wrapped in a run-group border (it disappears when the run finishes).
 */
export function SkeletonMessageBubble({ skeleton }: SkeletonMessageBubbleProps) {
  return (
    <article className="flex min-h-0 justify-start" aria-live="polite">
      <div className="min-w-0 max-w-[min(420px,92%)] rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-sm py-xs text-[var(--app-panel-text)] transition-colors duration-200">
        <div className="flex items-center gap-xs">
          <Loader2
            aria-hidden="true"
            size={13}
            className="animate-spin text-[var(--app-icon-muted)]"
          />
          <div className="min-w-0">
            <p className="m-0 text-[12px] font-[520] leading-4">{skeleton.label}</p>
            {skeleton.detail ? (
              <p className="m-0 truncate text-[11px] leading-4 text-[var(--app-muted)]">
                {skeleton.detail}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
