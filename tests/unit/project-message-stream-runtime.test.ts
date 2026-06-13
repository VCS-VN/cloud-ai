import { describe, expect, it } from "vitest";
import {
  publishRuntimeEvent,
  subscribeRuntime,
} from "@/server/functions/project-message-stream";

describe("project runtime stream", () => {
  it("does not replay preview reload requests to late subscribers", () => {
    const projectId = `project-${crypto.randomUUID()}`;
    const received: string[] = [];

    publishRuntimeEvent(projectId, {
      type: "preview_reload_requested",
      projectId,
      reason: "store_slug_synced",
      delayMs: 5000,
      at: "2026-06-15T00:00:00.000Z",
    });

    const unsubscribe = subscribeRuntime(projectId, (event) => {
      received.push(event.type);
    });
    unsubscribe();

    expect(received).toEqual([]);
  });

  it("replays the latest lifecycle snapshot to late subscribers", () => {
    const projectId = `project-${crypto.randomUUID()}`;
    const received: string[] = [];

    publishRuntimeEvent(projectId, {
      type: "dev_ready",
      projectId,
      runId: "run-1",
      previewUrl: "http://127.0.0.1:5173",
      port: 5173,
    });

    const unsubscribe = subscribeRuntime(projectId, (event) => {
      received.push(event.type);
    });
    unsubscribe();

    expect(received).toEqual(["dev_ready"]);
  });
});
