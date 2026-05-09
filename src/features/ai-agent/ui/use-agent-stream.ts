import { useCallback, useReducer, useRef } from "react";
import { agentEventReducer, createInitialAgentEventState } from "./agent-event-reducer";
import type { AgentStreamEvent } from "../agent/agent-events";

export function useAgentStream(args?: { onDone?: (event: Extract<AgentStreamEvent, { type: "done" }>) => void }) {
  const [state, dispatch] = useReducer(agentEventReducer, undefined, createInitialAgentEventState);
  const sourceRef = useRef<EventSource | null>(null);

  const start = useCallback((url: string) => {
    sourceRef.current?.close();
    const source = new EventSource(url);
    sourceRef.current = source;
    source.addEventListener("agent_event", (message) => {
      const event = JSON.parse((message as MessageEvent).data) as AgentStreamEvent;
      dispatch(event);
      if (event.type === "done") args?.onDone?.(event);
    });
    return source;
  }, [args]);

  const stop = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  return { state, start, stop, dispatch };
}
