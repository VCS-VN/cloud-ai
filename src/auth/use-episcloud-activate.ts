import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { activateEpisCloud } from "@/server/functions/auth";

/**
 * Shared Epis Cloud activation flow for the builder-run blocking notice.
 *
 * When a build is blocked because the user hasn't activated Epis Cloud, both
 * the chat composer (project detail) and the dashboard create-project form show
 * an actionable notice whose CTA opens EpisCloudActivateDialog. This hook wraps
 * the dialog open/activating/error state + the activate server call, mirroring
 * the logic in ProfileSection's EpisCloudSection (left untouched). On success it
 * calls onActivated so the caller can clear its blocked state.
 */
export function useEpisCloudActivate(onActivated: () => void) {
  const activateFn = useServerFn(activateEpisCloud);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => {
    setError(null);
    setDialogOpen(true);
  }, []);

  const cancel = useCallback(() => {
    if (activating) return;
    setDialogOpen(false);
    setError(null);
  }, [activating]);

  const confirm = useCallback(async () => {
    if (activating) return;
    setActivating(true);
    setError(null);
    try {
      await activateFn();
      setDialogOpen(false);
      onActivated();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not activate EpisCloud. Please try again.",
      );
    } finally {
      setActivating(false);
    }
  }, [activating, activateFn, onActivated]);

  return { dialogOpen, activating, error, open, cancel, confirm };
}
