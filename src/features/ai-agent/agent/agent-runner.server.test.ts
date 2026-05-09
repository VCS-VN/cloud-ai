import { describe, expect, it } from "vitest";
import { AgentRunner, withProjectMutationLock } from "./agent-runner.server";
import type { AgentStreamEvent } from "./agent-events";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("withProjectMutationLock", () => {
  it("serializes runs for the same project", async () => {
    const firstRelease = deferred();
    const order: string[] = [];

    const first = withProjectMutationLock({
      projectId: "project_lock_test",
      run: async () => {
        order.push("first:start");
        await firstRelease.promise;
        order.push("first:end");
      },
    });

    const second = withProjectMutationLock({
      projectId: "project_lock_test",
      run: async () => {
        order.push("second:start");
      },
    });

    await Promise.resolve();
    expect(order).toEqual(["first:start"]);
    firstRelease.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(["first:start", "first:end", "second:start"]);
  });
});

describe("AgentRunner", () => {
  it("streams sanitized code tool events from the orchestrator", async () => {
    const events: AgentStreamEvent[] = [
      { type: "code_tool_loop_started", projectId: "project_1", messageId: "msg_1", taskTitle: "Update product card" },
      { type: "tool_call_completed", projectId: "project_1", messageId: "msg_1", toolName: "project_read_file", ok: true, summary: "Read safe file", recoverable: false },
      { type: "code_tool_loop_completed", projectId: "project_1", messageId: "msg_1", summary: "Done", changedFiles: ["src/App.tsx"], validationStatus: "passed" },
    ];
    const orchestrator = {
      async *handlePromptStream() {
        for (const event of events) yield event;
      },
    };
    const runner = new AgentRunner(orchestrator as never);
    const streamed: AgentStreamEvent[] = [];

    for await (const event of runner.handlePromptStream({ projectId: "project_1", prompt: "add wishlist" })) {
      streamed.push(event);
    }

    expect(streamed).toEqual(events);
  });
});
