import { describe, expect, it, vi } from "vitest";
import { RuntimeOrchestrator } from "@/features/runtime/legacy/runtime-orchestrator.server";

function createOrchestrator({
  stop = vi.fn(async () => {}),
  deleteProcess = vi.fn(async () => {}),
  readDevRuntime = vi.fn(async () => ({
    previewHost: null,
    cloudflareDnsRecordId: null,
    port: null,
  })),
  patchDevRuntime = vi.fn(async () => ({})),
}: {
  stop?: ReturnType<typeof vi.fn>;
  deleteProcess?: ReturnType<typeof vi.fn>;
  readDevRuntime?: ReturnType<typeof vi.fn>;
  patchDevRuntime?: ReturnType<typeof vi.fn>;
} = {}) {
  const orchestrator = new RuntimeOrchestrator({
    projectStateStore: {
      readDevRuntime,
      patchDevRuntime,
    },
    pm2Driver: {
      stop,
      delete: deleteProcess,
      describe: vi.fn(),
      start: vi.fn(),
    },
    portAllocator: {
      allocate: vi.fn(),
      release: vi.fn(),
    },
  } as never);
  return { orchestrator, stop, deleteProcess, readDevRuntime, patchDevRuntime };
}

describe("RuntimeOrchestrator.stopPreview", () => {
  it("stops the PM2 process and updates project state without deleting the process", async () => {
    const { orchestrator, stop, deleteProcess, patchDevRuntime } = createOrchestrator();

    const result = await orchestrator.stopPreview("project-1", "user-1");

    expect(result).toEqual({ success: true });
    expect(stop).toHaveBeenCalledWith("project-1");
    expect(deleteProcess).not.toHaveBeenCalled();
    expect(patchDevRuntime).toHaveBeenCalledWith(
      "project-1",
      {
        status: "stopped",
        pid: null,
        lastError: null,
        lastErrorTier: null,
      },
      "user-1",
    );
  });

  it("still updates project state when PM2 stop fails", async () => {
    const stop = vi.fn(async () => {
      throw new Error("pm2 stop failed");
    });
    const { orchestrator, patchDevRuntime } = createOrchestrator({ stop });

    const result = await orchestrator.stopPreview("project-1", "user-1");

    expect(result).toEqual({
      success: false,
      error: "pm2 stop failed",
      pm2StopAttempted: true,
      databaseUpdateAttempted: true,
    });
    expect(patchDevRuntime).toHaveBeenCalledWith(
      "project-1",
      {
        status: "stopped",
        pid: null,
        lastError: null,
        lastErrorTier: null,
      },
      "user-1",
    );
  });
});

describe("RuntimeOrchestrator.teardownPreview", () => {
  it("deletes the PM2 project instance during project deletion teardown", async () => {
    const { orchestrator, deleteProcess, patchDevRuntime } = createOrchestrator();

    const result = await orchestrator.teardownPreview("project-1", "user-1");

    expect(result).toEqual({ success: true });
    expect(deleteProcess).toHaveBeenCalledWith("project-1");
    expect(patchDevRuntime).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({
        enabled: false,
        status: "stopped",
        pid: null,
        port: null,
        previewUrl: null,
        previewHost: null,
      }),
      "user-1",
    );
  });
});
