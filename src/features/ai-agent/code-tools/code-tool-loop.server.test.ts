import { describe, expect, it } from "vitest";
import { runBoundedCodeToolLoop } from "./code-tool-loop.server";

describe("bounded code tool loop", () => {
  it("starts repair until max attempts then rolls back", async () => {
    const events: unknown[] = [];
    const result = await runBoundedCodeToolLoop({
      projectId: "project_1",
      messageId: "msg_1",
      taskTitle: "Fix types",
      changedFiles: ["src/App.tsx"],
      maxRepairAttempts: 2,
      validate: async () => ({ status: "failed", commands: [], canRepair: true }),
      repair: async () => ({ changedFiles: ["src/App.tsx"], repaired: false }),
      rollback: async () => undefined,
      sendEvent: (event) => { events.push(event); },
    });

    expect(result.status).toBe("failed");
    expect(events.filter((event) => (event as { type?: string }).type === "repair_started")).toHaveLength(2);
    expect(events.some((event) => (event as { summary?: string }).summary?.includes("rolled back"))).toBe(true);
  });

  it("returns human review before validation for high-risk changes", async () => {
    const result = await runBoundedCodeToolLoop({
      projectId: "project_1",
      messageId: "msg_1",
      taskTitle: "Update env",
      changedFiles: [".env"],
      validate: async () => { throw new Error("should not validate"); },
      sendEvent: () => undefined,
    });

    expect(result.status).toBe("human_review_required");
    expect(result.reason).toContain("sensitive");
  });
});
