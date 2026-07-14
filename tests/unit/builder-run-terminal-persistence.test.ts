import { describe, expect, it, vi } from "vitest";
import { __builderRunDispatcherTestables } from "@/server/services/builder-run-dispatcher.server";

describe("builder run terminal persistence", () => {
  it("clears project processing state even when the run is already completed", async () => {
    const updateProjectProcessingState = vi.fn().mockResolvedValue({
      id: "project-1",
      processingStatus: "idle",
      activeRunId: undefined,
    });
    const runStoreUpdate = vi.fn();
    const persistence = {
      projectRepository: { updateProjectProcessingState },
      runStore: {
        load: vi.fn().mockResolvedValue({
          id: "run-1",
          projectId: "project-1",
          status: "completed",
        }),
        update: runStoreUpdate,
      },
      messageRepository: {},
    };

    await __builderRunDispatcherTestables.persistRunTerminal(
      persistence as never,
      "project-1",
      "run-1",
      "user-1",
      "completed",
      "en",
    );

    expect(runStoreUpdate).not.toHaveBeenCalled();
    expect(updateProjectProcessingState).toHaveBeenCalledWith(
      "project-1",
      "idle",
      "user-1",
    );
  });

  it("clears project processing state even when the run row is missing", async () => {
    const updateProjectProcessingState = vi.fn().mockResolvedValue({
      id: "project-1",
      processingStatus: "idle",
      activeRunId: undefined,
    });
    const persistence = {
      projectRepository: { updateProjectProcessingState },
      runStore: {
        load: vi.fn().mockResolvedValue(undefined),
      },
      messageRepository: {},
    };

    await __builderRunDispatcherTestables.persistRunTerminal(
      persistence as never,
      "project-1",
      "run-1",
      "user-1",
      "completed",
      "en",
    );

    expect(updateProjectProcessingState).toHaveBeenCalledWith(
      "project-1",
      "idle",
      "user-1",
    );
  });
});
