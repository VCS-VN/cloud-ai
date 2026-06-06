import { useEffect, useState } from "react";
import type {
  BuilderRunEvent,
  BuilderRunFailureCode,
  BuilderRunMilestone,
} from "@/features/agents/ui/builder-events";

export type BuilderRunStreamState = {
  events: BuilderRunEvent[];
  milestone: BuilderRunMilestone | null;
  failureCode: BuilderRunFailureCode | null;
  optionalRouteWarnings: string[];
  closed: boolean;
};

const INITIAL_STATE: BuilderRunStreamState = {
  events: [],
  milestone: null,
  failureCode: null,
  optionalRouteWarnings: [],
  closed: false,
};

export function useBuilderRunStream(input: {
  projectId: string;
  runId: string | null;
}): BuilderRunStreamState {
  const [state, setState] = useState<BuilderRunStreamState>(INITIAL_STATE);

  useEffect(() => {
    if (!input.runId) {
      setState(INITIAL_STATE);
      return;
    }
    setState(INITIAL_STATE);
    const url = `/api/projects/${input.projectId}/builder-runs/${input.runId}/stream`;
    const source = new EventSource(url);
    const handle = (rawEvent: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(rawEvent.data) as BuilderRunEvent;
        setState((prev) => {
          const next: BuilderRunStreamState = {
            events: [...prev.events, parsed],
            milestone:
              parsed.type === "milestone"
                ? parsed.milestone
                : parsed.type === "done"
                  ? "done"
                  : parsed.type === "failed"
                    ? "failed"
                    : parsed.type === "cancelled"
                      ? "cancelled"
                      : prev.milestone,
            failureCode:
              parsed.type === "failed" ? parsed.failureCode : prev.failureCode,
            optionalRouteWarnings: prev.optionalRouteWarnings,
            closed:
              parsed.type === "done" ||
              parsed.type === "failed" ||
              parsed.type === "cancelled",
          };
          if (next.closed) source.close();
          return next;
        });
      } catch {
        // ignore malformed events
      }
    };
    source.addEventListener("milestone", handle as unknown as EventListener);
    source.addEventListener("done", handle as unknown as EventListener);
    source.addEventListener("failed", handle as unknown as EventListener);
    source.addEventListener("cancelled", handle as unknown as EventListener);
    source.addEventListener("error", () => {
      setState((prev) => ({ ...prev, closed: true }));
      source.close();
    });
    return () => source.close();
  }, [input.projectId, input.runId]);

  return state;
}
