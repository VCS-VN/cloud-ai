import { afterEach, describe, it, expect, vi } from "vitest";
import { REPAIR_MAX_CYCLES, runRepairLoop } from "@/features/agents/codex/runtime/repair-loop.server";
import type { BoundedCodexThread } from "@/features/agents/codex/runtime/codex-thread.server";

function fakeThread(): BoundedCodexThread {
  return {
    runTurn: vi.fn(async () => ({ finalResponse: "ok", usage: null, fileChanges: [] })),
    runTurnStreamed: vi.fn(async () => ({ finalResponse: "ok", usage: null, fileChanges: [] })),
    runStreamed: vi.fn(),
    threadId: "t",
  } as unknown as BoundedCodexThread;
}

describe("repair-loop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("cycles 0 when validation passes first time", async () => {
    const thread = fakeThread();
    const validate = vi.fn(async () => ({ ok: true as const, durationMs: 1 }));
    const result = await runRepairLoop({ thread, validate });
    expect(result.cyclesUsed).toBe(0);
    expect(result.finalOutcome.ok).toBe(true);
    expect(thread.runTurn).not.toHaveBeenCalled();
    expect(thread.runTurnStreamed).not.toHaveBeenCalled();
  });

  it("cycles 1 when first attempt fails then succeeds", async () => {
    const thread = fakeThread();
    let n = 0;
    const validate = vi.fn(async () => {
      n++;
      if (n === 1) return { ok: false as const, durationMs: 1, summary: "type error", errorCount: 1 };
      return { ok: true as const, durationMs: 1 };
    });
    const onCycleStart = vi.fn();
    const result = await runRepairLoop({ thread, validate, onCycleStart });
    expect(result.cyclesUsed).toBe(1);
    expect(result.finalOutcome.ok).toBe(true);
    expect(thread.runTurn).not.toHaveBeenCalled();
    expect(thread.runTurnStreamed).toHaveBeenCalledTimes(1);
    expect(onCycleStart).toHaveBeenCalledWith(1);
  });

  it("caps at REPAIR_MAX_CYCLES when validation keeps failing", async () => {
    const thread = fakeThread();
    const validate = vi.fn(async () => ({
      ok: false as const,
      durationMs: 1,
      summary: "still failing",
      errorCount: 1,
    }));
    const result = await runRepairLoop({ thread, validate });
    expect(result.cyclesUsed).toBe(REPAIR_MAX_CYCLES);
    expect(result.finalOutcome.ok).toBe(false);
    expect(thread.runTurn).not.toHaveBeenCalled();
    expect(thread.runTurnStreamed).toHaveBeenCalledTimes(REPAIR_MAX_CYCLES);
  });

  it("breaks early when the abort signal is set", async () => {
    const thread = fakeThread();
    const controller = new AbortController();
    const validate = vi.fn(async () => {
      controller.abort();
      return { ok: false as const, durationMs: 1, summary: "x", errorCount: 1 };
    });
    const result = await runRepairLoop({ thread, validate, signal: controller.signal });
    expect(result.cyclesUsed).toBe(1);
    expect(thread.runTurn).not.toHaveBeenCalled();
    expect(thread.runTurnStreamed).not.toHaveBeenCalled();
  });

  it("logs repair context and completion duration", async () => {
    const warnings: unknown[] = [];
    vi.spyOn(console, "warn").mockImplementation((raw) => {
      warnings.push(JSON.parse(String(raw)));
    });
    const thread = fakeThread();
    let n = 0;
    const validate = vi.fn(async () => {
      n++;
      if (n === 1) return { ok: false as const, durationMs: 1, summary: "type error", errorCount: 1 };
      return { ok: true as const, durationMs: 1 };
    });

    await runRepairLoop({
      thread,
      validate,
      stage: "typecheck",
      runId: "run-1",
      projectId: "project-1",
      changedFilesCount: 3,
    });

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "repair_cycle_started",
          repair_stage: "typecheck",
          cycle: 1,
          validation_summary: "type error",
          changedFilesCount: 3,
        }),
        expect.objectContaining({
          event: "repair_turn_started",
          repair_stage: "typecheck",
          cycle: 1,
        }),
        expect.objectContaining({
          event: "repair_turn_completed",
          repair_stage: "typecheck",
          cycle: 1,
          fileChangesCount: 0,
          finalResponseLength: 2,
        }),
      ]),
    );
    expect(warnings.find((entry) => (entry as { event?: string }).event === "repair_turn_completed")).toEqual(
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });

  it("forwards streamed repair progress events", async () => {
    const thread = fakeThread();
    const progress = vi.fn();
    (thread.runTurnStreamed as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_input, onProgress) => {
      onProgress({ kind: "command_started", command: "pnpm build" });
      return { finalResponse: "ok", usage: null, fileChanges: [] };
    });
    let n = 0;
    const validate = vi.fn(async () => {
      n++;
      if (n === 1) return { ok: false as const, durationMs: 1, summary: "build error", errorCount: 1 };
      return { ok: true as const, durationMs: 1 };
    });

    await runRepairLoop({ thread, validate, onProgress: progress });

    expect(progress).toHaveBeenCalledWith({ kind: "command_started", command: "pnpm build" });
  });

  it("logs heartbeat while a repair turn is still running", async () => {
    vi.useFakeTimers();
    const warnings: unknown[] = [];
    vi.spyOn(console, "warn").mockImplementation((raw) => {
      warnings.push(JSON.parse(String(raw)));
    });
    const thread = fakeThread();
    let resolveRepair!: () => void;
    (thread.runTurnStreamed as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRepair = () => resolve({ finalResponse: "ok", usage: null, fileChanges: [] });
        }),
    );
    let n = 0;
    const validate = vi.fn(async () => {
      n++;
      if (n === 1) return { ok: false as const, durationMs: 1, summary: "slow error", errorCount: 1 };
      return { ok: true as const, durationMs: 1 };
    });

    const promise = runRepairLoop({
      thread,
      validate,
      stage: "build",
      runId: "run-1",
      projectId: "project-1",
      heartbeatMs: 100,
    });
    await vi.advanceTimersByTimeAsync(100);
    resolveRepair();
    await promise;

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "repair_turn_heartbeat",
          repair_stage: "build",
          cycle: 1,
          durationMs: expect.any(Number),
        }),
      ]),
    );
  });
});
