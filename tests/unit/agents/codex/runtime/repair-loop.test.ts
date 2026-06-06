import { describe, it, expect, vi } from "vitest";
import { REPAIR_MAX_CYCLES, runRepairLoop } from "@/features/agents/codex/runtime/repair-loop.server";
import type { BoundedCodexThread } from "@/features/agents/codex/runtime/codex-thread.server";

function fakeThread(): BoundedCodexThread {
  return {
    runTurn: vi.fn(async () => ({ finalResponse: "ok", usage: null, fileChanges: [] })),
    runStreamed: vi.fn(),
    threadId: "t",
  } as unknown as BoundedCodexThread;
}

describe("repair-loop", () => {
  it("cycles 0 when validation passes first time", async () => {
    const thread = fakeThread();
    const validate = vi.fn(async () => ({ ok: true as const, durationMs: 1 }));
    const result = await runRepairLoop({ thread, validate });
    expect(result.cyclesUsed).toBe(0);
    expect(result.finalOutcome.ok).toBe(true);
    expect(thread.runTurn).not.toHaveBeenCalled();
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
    expect(thread.runTurn).toHaveBeenCalledTimes(1);
    expect(onCycleStart).toHaveBeenCalledWith(1);
  });

  it("caps at REPAIR_MAX_CYCLES (2) when validation keeps failing", async () => {
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
    expect(thread.runTurn).toHaveBeenCalledTimes(REPAIR_MAX_CYCLES);
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
  });
});
