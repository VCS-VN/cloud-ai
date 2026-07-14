import { HelpCircle, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentBody, RunnerStep } from "@/components/projects/MessageBubble";
import type { Message } from "@/shared/project-types";

export function RunnerDetailPanel({
  steps,
  runActive,
  onClose,
  clarification,
  planAwaitingReview,
  onSelectOption,
  onPlanAction,
  onSubmitFreeText,
}: {
  steps: Message[];
  runActive: boolean;
  onClose: () => void;
  // The pending interactive message (design variant / skill clarification /
  // free-text clarification / plan review) for THIS run, rendered as the last
  // message inside the runner. Null when the run isn't blocked on input.
  clarification: Message | null;
  planAwaitingReview: boolean;
  onSelectOption?: (
    messageId: string,
    optionId: string,
  ) => Promise<boolean | void>;
  onPlanAction?: (
    message: Message,
    action: "approve" | "reject",
  ) => Promise<void>;
  onSubmitFreeText?: (
    message: Message,
    freeText: string,
  ) => Promise<boolean | void>;
}) {
  const sorted = [...steps].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  // The agent's final answer is pulled out of the timeline and rendered as a
  // prominent always-open block at the end (see the lovable reference), so the
  // user reads the completed reply without expanding a collapsed step. The
  // remaining steps (reasoning / edits / commands) stay in the timeline.
  const finalAnswer =
    !runActive && !clarification
      ? [...sorted].reverse().find((m) => m.kind === "answer") ?? null
      : null;
  const ordered = finalAnswer
    ? sorted.filter((m) => m.id !== finalAnswer.id)
    : sorted;
  const stepCount =
    ordered.length + (clarification ? 1 : 0) + (finalAnswer ? 1 : 0);
  const isEmpty = stepCount === 0;

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
          {stepCount} {stepCount === 1 ? "step" : "steps"}
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
        {isEmpty ? (
          <div className="flex h-full items-center justify-center text-center text-[12px] text-subtle">
            {runActive
              ? "Waiting for the agent's first step…"
              : "No steps recorded for this run."}
          </div>
        ) : (
          <>
            {ordered.length > 0 || clarification ? (
              <ol className="flex flex-col">
                {ordered.map((step, index) => (
                  <RunnerStep
                    key={step.id}
                    step={step}
                    isFirst={index === 0}
                    isLast={!clarification && index === ordered.length - 1}
                  />
                ))}
                {clarification ? (
                  <li className="relative flex list-none gap-2.5">
                    <span
                      aria-hidden="true"
                      className="absolute left-2 top-0 h-2.5 w-px -translate-x-1/2 bg-hairline"
                    />
                    <span className="relative z-10 mt-[3px] flex h-3.5 w-4 shrink-0 items-center justify-center bg-paper text-subtle">
                      <HelpCircle aria-hidden="true" size={13} />
                    </span>
                    <section
                      aria-label="Agent needs your input"
                      className="min-w-0 flex-1 overflow-hidden rounded-lg border border-hairline bg-surface"
                    >
                      <div className="flex items-center gap-1.5 border-b border-hairline px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-subtle">
                        Needs your input
                      </div>
                      <div className="px-3 py-2.5">
                        <AgentBody
                          message={clarification}
                          planAwaitingReview={planAwaitingReview}
                          onSelectOption={onSelectOption}
                          onPlanAction={onPlanAction}
                          onSubmitFreeText={onSubmitFreeText}
                        />
                      </div>
                    </section>
                  </li>
                ) : null}
              </ol>
            ) : null}

            {finalAnswer ? (
              <section
                aria-label="Agent's final message"
                className={`min-w-0 overflow-hidden rounded-lg border border-hairline bg-surface ${
                  ordered.length > 0 ? "mt-1" : ""
                }`}
              >
                <div className="flex items-center gap-1.5 border-b border-hairline px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-subtle">
                  <Sparkles aria-hidden="true" size={12} />
                  Final message
                </div>
                <div className="px-3 py-2.5">
                  <AgentBody message={finalAnswer} />
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
