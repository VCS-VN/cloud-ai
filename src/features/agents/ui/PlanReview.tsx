import { useState } from "react";
import { Button } from "@/components/ui/button";

export type PlanReviewProps = {
  planMarkdown: string;
  onApprove: () => Promise<void> | void;
  onReject: () => Promise<void> | void;
  disabled?: boolean;
};

/**
 * Plan-mode review UI (T056). Renders the plan markdown body with explicit
 * Approve / Reject buttons. The body uses the same markdown rendering as
 * existing plan messages; this component focuses on the action surface.
 */
export function PlanReview({ planMarkdown, onApprove, onReject, disabled }: PlanReviewProps) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const isDisabled = disabled || busy !== null;

  const handle = async (action: "approve" | "reject") => {
    setBusy(action);
    try {
      if (action === "approve") await onApprove();
      else await onReject();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <pre className="whitespace-pre-wrap text-sm text-app-fg/90 font-sans">
        {planMarkdown}
      </pre>
      <div className="flex gap-2 pt-1">
        <Button
          variant="unstyled"
          type="button"
          onClick={() => handle("approve")}
          disabled={isDisabled}
          className="bg-app-accent text-app-on-accent hover:bg-app-accent-hover disabled:opacity-60 px-4 py-2 rounded-md text-sm"
        >
          {busy === "approve" ? "Applying…" : "Approve"}
        </Button>
        <Button
          variant="unstyled"
          type="button"
          onClick={() => handle("reject")}
          disabled={isDisabled}
          className="bg-app-surface-2 text-app-fg hover:bg-app-surface-3 disabled:opacity-60 px-4 py-2 rounded-md text-sm border border-app-border"
        >
          {busy === "reject" ? "Cancelling…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}
