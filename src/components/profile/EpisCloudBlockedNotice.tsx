import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Actionable notice shown when a builder run is blocked because the user has
 * not activated Epis Cloud. Soft/informational styling (not danger tokens):
 * this is an expected, recoverable state, not an error. Mirrors the "no-api-key"
 * treatment in ModelPicker, but the CTA activates inline via a dialog instead of
 * navigating to /settings — the user is mid-action (a prompt they just typed)
 * and navigating away would lose that context.
 */
export function EpisCloudBlockedNotice({
  onActivateClick,
}: {
  onActivateClick: () => void;
}) {
  return (
    <div className="rounded-md border border-hairline bg-surface p-3" role="status">
      <div className="flex items-start gap-2">
        <Sparkles aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-subtle" />
        <p className="m-0 text-ui-sm leading-relaxed text-muted">
          Activate EpisCloud to run AI builds on your account.
        </p>
      </div>
      <Button type="button" className="mt-3 h-9 w-full" onClick={onActivateClick}>
        Activate EpisCloud
      </Button>
    </div>
  );
}
