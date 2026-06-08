import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BoundedCodexThread } from "@/features/agents/codex/runtime/codex-thread.server";

type FakeThread = {
  run: ReturnType<typeof vi.fn>;
  id: string;
};

function makeThread(impl: (callIndex: number) => unknown | Promise<unknown>): FakeThread {
  let callIndex = 0;
  return {
    id: "thread-test",
    run: vi.fn(async () => {
      const result = await impl(callIndex++);
      return result;
    }),
  };
}

const SUCCESS_TURN = {
  items: [],
  finalResponse: "ok",
  usage: null,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("BoundedCodexThread.runTurn retry semantics", () => {
  it("returns the first successful result without delay", async () => {
    const thread = makeThread(() => SUCCESS_TURN);
    const bounded = new BoundedCodexThread(thread as never);
    const result = await bounded.runTurn({ prompt: "p" });
    expect(result.finalResponse).toBe("ok");
    expect(thread.run).toHaveBeenCalledTimes(1);
  });

  it("retries up to 10 times on transient errors before giving up", async () => {
    const thread = makeThread(() => {
      throw new Error("transient");
    });
    const bounded = new BoundedCodexThread(thread as never);

    const promise = bounded.runTurn({ prompt: "p" });
    promise.catch(() => undefined);
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow("transient");
    expect(thread.run).toHaveBeenCalledTimes(10);
  });

  it("succeeds on a later attempt when the first few throw", async () => {
    const thread = makeThread((i) => {
      if (i < 3) throw new Error(`fail ${i}`);
      return SUCCESS_TURN;
    });
    const bounded = new BoundedCodexThread(thread as never);

    const promise = bounded.runTurn({ prompt: "p" });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.finalResponse).toBe("ok");
    expect(thread.run).toHaveBeenCalledTimes(4);
  });

  it("resets retry budget on success — subsequent runTurn() can fail+recover independently", async () => {
    let phase = 1;
    let phase1Calls = 0;
    let phase2Calls = 0;
    const thread = makeThread(() => {
      if (phase === 1) {
        const idx = phase1Calls++;
        if (idx < 2) throw new Error(`p1 fail ${idx}`);
        return SUCCESS_TURN;
      }
      const idx = phase2Calls++;
      if (idx < 5) throw new Error(`p2 fail ${idx}`);
      return SUCCESS_TURN;
    });
    const bounded = new BoundedCodexThread(thread as never);

    const p1 = bounded.runTurn({ prompt: "p1" });
    await vi.runAllTimersAsync();
    await p1;
    expect(phase1Calls).toBe(3); // 2 fails + 1 success

    phase = 2;
    const p2 = bounded.runTurn({ prompt: "p2" });
    await vi.runAllTimersAsync();
    await p2;
    // Phase 2 starts a fresh retry budget. Without budget reset, p2 would
    // already be 1 attempt deep (or burned through). With reset, it tolerates
    // up to 10 failures and recovers on the 6th attempt.
    expect(phase2Calls).toBe(6); // 5 fails + 1 success
    expect(thread.run).toHaveBeenCalledTimes(9);
  });

  it("propagates AbortError immediately without retry", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    const thread = makeThread(() => {
      throw abortError;
    });
    const bounded = new BoundedCodexThread(thread as never);

    await expect(
      bounded.runTurn({ prompt: "p" }),
    ).rejects.toBe(abortError);
    expect(thread.run).toHaveBeenCalledTimes(1);
  });

  it("aborts mid-backoff when the signal fires", async () => {
    const controller = new AbortController();
    const thread = makeThread(() => {
      throw new Error("transient");
    });
    const bounded = new BoundedCodexThread(thread as never);

    const promise = bounded.runTurn({ prompt: "p", signal: controller.signal });
    promise.catch(() => undefined);
    // Let first attempt fail and enter backoff
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    // Only the first attempt ran; abort fired during backoff.
    expect(thread.run.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("treats gateway-error finalResponse as a transient failure and retries", async () => {
    let calls = 0;
    const thread = makeThread(() => {
      calls++;
      if (calls < 3) {
        return {
          items: [{ type: "agent_message" }],
          finalResponse: "[gateway error: upstream model error — please retry in a moment]",
          usage: null,
        };
      }
      return SUCCESS_TURN;
    });
    const bounded = new BoundedCodexThread(thread as never);

    const promise = bounded.runTurn({ prompt: "p" });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.finalResponse).toBe("ok");
    expect(thread.run).toHaveBeenCalledTimes(3);
  });

  it("does NOT misclassify a normal answer that contains the word 'error' somewhere mid-text", async () => {
    const thread = makeThread(() => ({
      items: [{ type: "agent_message" }],
      finalResponse:
        "Đây là kế hoạch xử lý error log của user. Bạn có thể thử lại sau nếu cần.",
      usage: null,
    }));
    const bounded = new BoundedCodexThread(thread as never);
    const promise = bounded.runTurn({ prompt: "p" });
    await vi.runAllTimersAsync();
    const result = await promise;
    // Patterns are anchored to the start of the response; a normal answer
    // mentioning "error" mid-text must not trigger a retry.
    expect(thread.run).toHaveBeenCalledTimes(1);
    expect(result.finalResponse.startsWith("Đây là")).toBe(true);
  });

  it("does NOT throw when fileChanges or skill calls accompany the suspect text", async () => {
    // If the model actually performed work AND its narrative happens to start
    // with "[gateway error" (vanishingly rare but possible in skill output),
    // we still trust the work — the heuristic only fires on empty turns.
    const thread = makeThread(() => ({
      items: [{ type: "file_change", changes: [{ path: "src/a.tsx" }] }],
      finalResponse: "[gateway error: foo]",
      usage: null,
    }));
    const bounded = new BoundedCodexThread(thread as never);
    const result = await bounded.runTurn({ prompt: "p" });
    expect(result.fileChanges).toEqual(["src/a.tsx"]);
    expect(thread.run).toHaveBeenCalledTimes(1);
  });
});
