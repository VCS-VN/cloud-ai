import { describe, expect, it } from "vitest";
import { runProjectValidation } from "./project-validation-service.server";

describe("project validation service", () => {
  it("reports passed commands", async () => {
    const result = await runProjectValidation({
      workspaceRoot: "/tmp/project",
      commands: ["npm run typecheck"],
      runner: async () => ({ exitCode: 0, stdout: "ok", stderr: "", durationMs: 5 }),
    });

    expect(result.status).toBe("passed");
    expect(result.canRepair).toBe(false);
    expect(result.commands[0]).toMatchObject({ status: "passed", exitCode: 0 });
  });

  it("reports failed redacted and truncated output", async () => {
    const result = await runProjectValidation({
      workspaceRoot: "/tmp/project",
      commands: ["npm run lint"],
      maxSummaryChars: 40,
      runner: async () => ({ exitCode: 1, stdout: `token=sk-live-secret ${"x".repeat(120)}`, stderr: "", durationMs: 7 }),
    });

    expect(result.status).toBe("failed");
    expect(result.canRepair).toBe(true);
    expect(result.commands[0].stdoutSummary).toContain("[REDACTED]");
    expect(result.commands[0].stdoutSummary?.length).toBeLessThanOrEqual(41);
  });

  it("skips disallowed or missing commands", async () => {
    const result = await runProjectValidation({
      workspaceRoot: "/tmp/project",
      commands: ["cat .env"],
      runner: async () => { throw new Error("should not run"); },
    });

    expect(result.status).toBe("skipped");
    expect(result.commands[0]).toMatchObject({ status: "skipped" });
  });
});
