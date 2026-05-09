import { describe, expect, it } from "vitest";
import { serializeMessageStreamEvent } from "./project-message-stream";

describe("project message stream serialization", () => {
  it("redacts secrets before serializing stream events", () => {
    const serialized = serializeMessageStreamEvent({
      type: "message.failed",
      messageId: "msg_1",
      content: "",
      processingStatus: "failed",
      projectProcessingStatus: "idle",
      error: { code: "PROVIDER_STREAM_FAILED", message: "STRIPE_SECRET_KEY=super-secret" },
    });

    expect(serialized).toContain("[REDACTED]");
    expect(serialized).not.toContain("super-secret");
  });
});
