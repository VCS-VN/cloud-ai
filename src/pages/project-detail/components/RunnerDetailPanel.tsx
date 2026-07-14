import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RunnerStep } from "@/components/projects/MessageBubble";
import type { Message } from "@/shared/project-types";

export function RunnerDetailPanel({
  steps,
  runActive,
  onClose,
}: {
  steps: Message[];
  runActive: boolean;
  onClose: () => void;
}) {
  const ordered = [...steps].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      <header className="flex shrink-0 items-center gap-2 border-b border-hairline px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
          {runActive ? (
            <Loader2
              aria-hidden="true"
              size={13}
              className="animate-spin text-muted"
            />
          ) : null}
          Agent activity
        </span>
        <span className="text-[11px] text-subtle">
          {ordered.length} {ordered.length === 1 ? "step" : "steps"}
        </span>
        <Button
          variant="unstyled"
          type="button"
          onClick={onClose}
          aria-label="Close activity detail"
          className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-ink/[0.04] hover:text-ink focus-ring cursor-pointer"
        >
          <X aria-hidden="true" size={14} />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {ordered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-[12px] text-subtle">
            {runActive
              ? "Waiting for the agent's first step…"
              : "No steps recorded for this run."}
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {ordered.map((step) => (
              <li key={step.id} className="list-none">
                <RunnerStep step={step} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
