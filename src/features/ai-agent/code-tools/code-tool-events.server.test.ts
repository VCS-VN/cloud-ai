import { describe, expect, it } from "vitest";
import { buildToolCallCompletedEvent, buildValidationFinishedEvent } from "./code-tool-events.server";

describe("code tool event builders", () => {
  it("sanitizes tool errors", () => {
    const event = buildToolCallCompletedEvent({
      projectId: "project_1",
      messageId: "msg_1",
      toolName: "project_read_file",
      ok: false,
      summary: `failed sk-live-secret ${"x".repeat(400)}`,
      recoverable: true,
    });

    expect(event.summary).toContain("[REDACTED]");
    expect(event.summary).not.toContain("sk-live-secret");
    expect(event.summary.length).toBeLessThan(260);
  });

  it("builds validation status events without raw logs", () => {
    const event = buildValidationFinishedEvent({ projectId: "project_1", messageId: "msg_1", status: "failed", summary: "Typecheck failed" });
    expect(event).toMatchObject({ type: "validation_finished", projectId: "project_1", messageId: "msg_1", status: "failed" });
    expect(JSON.stringify(event)).not.toContain("stdout");
  });
});
