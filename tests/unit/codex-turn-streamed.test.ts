import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  BoundedCodexThread,
  type CodexProgressEvent,
} from "@/features/agents/codex/runtime/codex-thread.server";

// A scripted streamed turn: an array of ThreadEvent-shaped objects the fake
// thread yields in order. Mirrors the SDK's runStreamed().events generator.
function makeStreamingThread(
  scripts: unknown[][],
): { runStreamed: ReturnType<typeof vi.fn>; id: string } {
  let callIndex = 0;
  return {
    id: "thread-test",
    runStreamed: vi.fn(async () => {
      const events = scripts[Math.min(callIndex, scripts.length - 1)];
      callIndex += 1;
      return {
        events: (async function* () {
          for (const ev of events) yield ev as never;
        })(),
      };
    }),
  };
}

function reasoningItem(text: string) {
  return { type: "item.completed", item: { id: "r1", type: "reasoning", text } };
}
function fileChangeItem(paths: string[]) {
  return {
    type: "item.completed",
    item: {
      id: "f1",
      type: "file_change",
      status: "completed",
      changes: paths.map((p) => ({ path: p, kind: "add" })),
    },
  };
}
function agentMessage(text: string) {
  return { type: "item.completed", item: { id: "a1", type: "agent_message", text } };
}
const TURN_COMPLETED = {
  type: "turn.completed",
  usage: {
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 1,
    reasoning_output_tokens: 0,
  },
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("BoundedCodexThread.runTurnStreamed", () => {
  it("logs the SDK request payload before calling runStreamed when enabled", async () => {
    const previous = process.env.CODEX_LOG_REQUEST_BODY;
    process.env.CODEX_LOG_REQUEST_BODY = "true";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const controller = new AbortController();
    const thread = makeStreamingThread([[agentMessage("All done"), TURN_COMPLETED]]);
    const bounded = new BoundedCodexThread(
      thread as never,
      undefined,
      undefined,
      "test-model",
    );

    try {
      await bounded.runTurnStreamed(
        { prompt: "stream payload", signal: controller.signal },
        () => undefined,
      );
    } finally {
      if (previous === undefined) delete process.env.CODEX_LOG_REQUEST_BODY;
      else process.env.CODEX_LOG_REQUEST_BODY = previous;
    }

    const requestLog = logSpy.mock.calls
      .map(([line]) => JSON.parse(String(line)) as Record<string, unknown>)
      .find((entry) => entry.event === "codex_sdk_request_payload");
    expect(requestLog).toMatchObject({
      path: "runTurnStreamed",
      model: "test-model",
      promptLength: "stream payload".length,
      payload: {
        prompt: "stream payload",
        options: { signal: "present" },
      },
    });
    expect(thread.runStreamed).toHaveBeenCalledWith("stream payload", {
      signal: controller.signal,
    });
  });

  it("fires onProgress for reasoning + file change, returns the summary", async () => {
    const thread = makeStreamingThread([
      [
        { type: "thread.started", thread_id: "t1" },
        { type: "turn.started" },
        { type: "item.started", item: { id: "r1", type: "reasoning", text: "" } },
        reasoningItem("Thinking about layout"),
        {
          type: "item.started",
          item: {
            id: "f1",
            type: "file_change",
            status: "completed",
            changes: [{ path: "src/routes/index.tsx", kind: "add" }],
          },
        },
        fileChangeItem(["src/routes/index.tsx"]),
        agentMessage("All done"),
        TURN_COMPLETED,
      ],
    ]);
    const bounded = new BoundedCodexThread(thread as never);
    const progress: CodexProgressEvent[] = [];
    const summary = await bounded.runTurnStreamed({ prompt: "p" }, (ev) =>
      progress.push(ev),
    );

    expect(summary.finalResponse).toBe("All done");
    expect(summary.reasoning).toEqual(["Thinking about layout"]);
    expect(summary.fileChanges).toEqual(["src/routes/index.tsx"]);

    // Progress order: reasoning before file_change_completed; started fires too.
    const kinds = progress.map((p) => p.kind);
    expect(kinds).toContain("reasoning");
    expect(kinds).toContain("file_change_started");
    expect(kinds).toContain("file_change_completed");
    expect(kinds.indexOf("reasoning")).toBeLessThan(
      kinds.indexOf("file_change_completed"),
    );
  });

  it("IGNORES transient stream error events (the reconnect notice) and completes", async () => {
    // This is the exact runtime failure the user hit:
    // "Reconnecting... 2/5 (stream disconnected before completion:
    //  WebSocket protocol error: Handshake not finished)".
    // The CLI recovers internally and keeps streaming items afterward.
    const thread = makeStreamingThread([
      [
        reasoningItem("Step 1"),
        {
          type: "error",
          message:
            "Reconnecting... 2/5 (stream disconnected before completion: WebSocket protocol error: Handshake not finished)",
        },
        fileChangeItem(["src/routes/index.tsx"]),
        agentMessage("Recovered and finished"),
        TURN_COMPLETED,
      ],
    ]);
    const bounded = new BoundedCodexThread(thread as never);
    const progress: CodexProgressEvent[] = [];
    const summary = await bounded.runTurnStreamed({ prompt: "p" }, (ev) =>
      progress.push(ev),
    );

    // Single attempt — the error did NOT trigger the outer retry loop.
    expect(thread.runStreamed).toHaveBeenCalledTimes(1);
    expect(summary.finalResponse).toBe("Recovered and finished");
    expect(summary.fileChanges).toEqual(["src/routes/index.tsx"]);
  });

  it("throws on turn.failed and retries with backoff", async () => {
    const thread = makeStreamingThread([
      [{ type: "turn.failed", error: { message: "model exploded" } }],
      [agentMessage("second attempt ok"), TURN_COMPLETED],
    ]);
    const bounded = new BoundedCodexThread(thread as never);
    const promise = bounded.runTurnStreamed({ prompt: "p" }, () => {});
    await vi.runAllTimersAsync();
    const summary = await promise;
    expect(thread.runStreamed).toHaveBeenCalledTimes(2);
    expect(summary.finalResponse).toBe("second attempt ok");
  });

  it("retries on a soft-gateway-error final response, then succeeds", async () => {
    const thread = makeStreamingThread([
      [agentMessage("[gateway error: please retry in a moment]"), TURN_COMPLETED],
      [agentMessage("real answer"), TURN_COMPLETED],
    ]);
    const bounded = new BoundedCodexThread(thread as never);
    const promise = bounded.runTurnStreamed({ prompt: "p" }, () => {});
    await vi.runAllTimersAsync();
    const summary = await promise;
    expect(thread.runStreamed).toHaveBeenCalledTimes(2);
    expect(summary.finalResponse).toBe("real answer");
  });

  it("rejects promptly when the signal is already aborted (no retry)", async () => {
    const thread = makeStreamingThread([[agentMessage("never"), TURN_COMPLETED]]);
    const bounded = new BoundedCodexThread(thread as never);
    const controller = new AbortController();
    controller.abort();
    await expect(
      bounded.runTurnStreamed({ prompt: "p", signal: controller.signal }, () => {}),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(thread.runStreamed).not.toHaveBeenCalled();
  });

  it("retries when reconnect notices fire AND the turn produces no work", async () => {
    // Exact scenario from the runtime log: 4 reconnect notices, then a turn
    // that "completes" with only a stub agent_message describing intent
    // (zero file_change, zero reasoning, zero skill calls). The gate MUST
    // throw so a fresh CLI process gets a clean retry.
    const thread = makeStreamingThread([
      [
        { type: "error", message: "Reconnecting... 2/5 (stream disconnected before completion: WebSocket protocol error: Handshake not finished)" },
        { type: "error", message: "Reconnecting... 3/5 (stream disconnected before completion: WebSocket protocol error: Handshake not finished)" },
        { type: "error", message: "Reconnecting... 4/5 (stream disconnected before completion: WebSocket protocol error: Handshake not finished)" },
        { type: "error", message: "Reconnecting... 5/5 (stream disconnected before completion: WebSocket protocol error: Handshake not finished)" },
        agentMessage("Will build a grocery storefront with Premium Market styling..."),
        TURN_COMPLETED,
      ],
      [
        reasoningItem("Reconnect succeeded — actually building"),
        fileChangeItem(["src/routes/index.tsx"]),
        agentMessage("Built homepage"),
        TURN_COMPLETED,
      ],
    ]);
    const bounded = new BoundedCodexThread(thread as never);
    const progress: CodexProgressEvent[] = [];
    const promise = bounded.runTurnStreamed({ prompt: "p" }, (ev) =>
      progress.push(ev),
    );
    await vi.runAllTimersAsync();
    const summary = await promise;
    expect(thread.runStreamed).toHaveBeenCalledTimes(2);
    expect(summary.fileChanges).toEqual(["src/routes/index.tsx"]);
    expect(summary.finalResponse).toBe("Built homepage");
    // UI saw the reconnect notices live so the user wasn't watching a frozen
    // screen.
    const reconnectNotices = progress.filter((p) => p.kind === "reconnect_notice");
    expect(reconnectNotices.length).toBe(4);
    expect((reconnectNotices.at(-1) as { count: number }).count).toBe(4);
  });

  it("accepts a no-edit turn that has reasoning (planning / variant turns)", async () => {
    // Empty edits is fine when the turn was a planning/reasoning turn —
    // the reconnect-stub gate only fires when reconnect notices ALSO
    // happened. Without reconnects, we accept whatever the turn produced.
    const thread = makeStreamingThread([
      [
        reasoningItem("Planning the route changes"),
        agentMessage("Plan: edit X, add Y, then run validation."),
        TURN_COMPLETED,
      ],
    ]);
    const bounded = new BoundedCodexThread(thread as never);
    const summary = await bounded.runTurnStreamed({ prompt: "p" }, () => {});
    expect(summary.fileChanges).toEqual([]);
    expect(summary.finalResponse).toBe("Plan: edit X, add Y, then run validation.");
    expect(thread.runStreamed).toHaveBeenCalledTimes(1);
  });

  it("accepts an empty stream (integration-mock parity, no reconnects)", async () => {
    // Integration tests script empty event generators. Without reconnects,
    // an empty turn must NOT trigger the gate; otherwise every mock-backed
    // builder run hits the 10-attempt retry loop.
    const thread = makeStreamingThread([[]]);
    const bounded = new BoundedCodexThread(thread as never);
    const summary = await bounded.runTurnStreamed({ prompt: "p" }, () => {});
    expect(summary.fileChanges).toEqual([]);
    expect(summary.finalResponse).toBe("");
    expect(thread.runStreamed).toHaveBeenCalledTimes(1);
  });
});
