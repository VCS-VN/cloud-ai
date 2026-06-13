import { describe, expect, it } from "vitest";
import { shouldClearProjectProcessingOnCancel } from "@/server/services/cancel-run-reconciliation.server";

describe("shouldClearProjectProcessingOnCancel", () => {
  it("clears the project when the stopped run is the active run", () => {
    expect(
      shouldClearProjectProcessingOnCancel(
        { activeRunId: "run-1", processingStatus: "processing" },
        "run-1",
      ),
    ).toBe(true);
  });

  it("clears a stuck processing project that no longer has an active run id", () => {
    expect(
      shouldClearProjectProcessingOnCancel(
        { activeRunId: undefined, processingStatus: "processing" },
        "run-1",
      ),
    ).toBe(true);
  });

  it("does not clear a newer active run", () => {
    expect(
      shouldClearProjectProcessingOnCancel(
        { activeRunId: "run-2", processingStatus: "processing" },
        "run-1",
      ),
    ).toBe(false);
  });
});
