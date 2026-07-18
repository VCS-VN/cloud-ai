import { describe, expect, it, vi } from "vitest";
import { ProjectRunStore } from "@/features/projects/legacy/project-run-store.server";
import type { AgentRun } from "@/features/projects/legacy/project-state.schema";

function run(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: "run-1",
    projectId: "project-1",
    userId: "user-1",
    userPrompt: "build",
    planMode: false,
    status: "streaming",
    affectedFiles: [],
    startedAt: "2026-07-18T00:00:00.000Z",
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProjectRunStore mutation guards", () => {
  it("creates with insert-only repository path", async () => {
    const create = vi.fn(async (value: AgentRun) => value);
    const store = new ProjectRunStore({ create } as never);

    await store.create({ projectId: "project-1", userId: "user-1", userPrompt: "build" });

    expect(create).toHaveBeenCalledOnce();
  });

  it("rejects stale status transitions", async () => {
    const updateOwned = vi.fn(async () => undefined);
    const store = new ProjectRunStore({ updateOwned } as never);

    await expect(store.complete(run())).rejects.toThrow("ownership or status guard");
    expect(updateOwned).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
      "user-1",
      ["streaming", "awaiting_input"],
    );
  });
});
