import type { RuntimeStreamEvent } from "@/shared/project-types";
import type { DevRuntimeEvent } from "@/features/ai-agent/runtime/runtime-events";
import {
  publishRuntimeEvent,
  subscribeRuntime,
} from "@/server/functions/project-message-stream";

/**
 * Project-level broadcast for dev runtime events (install/start/ready/error/fix).
 * Lifetime is independent of any agent run: the preview server can keep emitting
 * after a run completes. Multiple subscribers (tabs) share one project channel.
 */
export class RuntimeBroadcastService {
  publish(projectId: string, event: DevRuntimeEvent): void {
    publishRuntimeEvent(projectId, event);
  }

  subscribe(
    projectId: string,
    enqueue: (event: RuntimeStreamEvent) => void,
  ): () => void {
    return subscribeRuntime(projectId, enqueue);
  }
}
