import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import type { DevRuntimeUIState } from "@/features/agents/ui/agent-event-reducer";

export function runtimeStatusBadge(
  state: DevRuntimeUIState,
  previewStarting = false,
): { label: string; tone: string; icon: React.ReactNode } | null {
  switch (state.status) {
    case "installing":
      return {
        label: "Installing...",
        tone: "border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-muted))]",
        icon: <Loader2 aria-hidden="true" className="animate-spin" size={12} />,
      };
    case "installed":
      return {
        label:
          state.durationMs !== null
            ? `Installed (${(state.durationMs / 1000).toFixed(1)}s)`
            : "Installed",
        tone: "border-success-bg bg-success-bg text-success-fg",
        icon: <CheckCircle2 aria-hidden="true" size={12} />,
      };
    case "starting":
      return {
        label: "Starting...",
        tone: "border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-muted))]",
        icon: <Loader2 aria-hidden="true" className="animate-spin" size={12} />,
      };
    case "running":
      return {
        label: "Running",
        tone: "border-success-bg bg-success-bg text-success-fg",
        icon: <CheckCircle2 aria-hidden="true" size={12} />,
      };
    case "stopped":
      return {
        label: previewStarting ? "Resuming..." : "Stopped",
        tone: "border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-muted))]",
        icon: previewStarting ? (
          <Loader2 aria-hidden="true" className="animate-spin" size={12} />
        ) : (
          <TriangleAlert aria-hidden="true" size={12} />
        ),
      };
    case "error":
      return {
        label: state.error ? `Error: ${state.error}` : "Error",
        tone: "border-[rgb(var(--color-hairline-soft))] bg-[rgb(var(--color-danger-bg))] text-[rgb(var(--color-danger-fg))]",
        icon: <TriangleAlert aria-hidden="true" size={12} />,
      };
    case "fixing":
      return {
        label: `Fixing error (attempt ${state.fixAttempt ?? "?"}/3)...`,
        tone: "border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-muted))]",
        icon: (
          <RefreshCw aria-hidden="true" className="animate-spin" size={12} />
        ),
      };
    default:
      return null;
  }
}
