import type { SkeletonState } from "@/shared/project-types";

type SkeletonMessageBubbleProps = {
  skeleton: SkeletonState;
};

/**
 * Ephemeral "agent is working" indicator. Muted text with a left-to-right
 * shimmer sweep (no pill, no border). Cleared when the run reaches a terminal
 * event. Not persisted.
 */
export function SkeletonMessageBubble({ skeleton }: SkeletonMessageBubbleProps) {
  return (
    <article className="flex min-h-0 justify-start" aria-live="polite">
      <div className="min-w-0 max-w-[min(420px,92%)]">
        <p className="skeleton-shimmer m-0 text-[12px] font-medium leading-5">
          {skeleton.label}
        </p>
        {skeleton.detail ? (
          <p className="m-0 truncate text-[11px] leading-4 text-muted/70">
            {skeleton.detail}
          </p>
        ) : null}
      </div>
    </article>
  );
}
