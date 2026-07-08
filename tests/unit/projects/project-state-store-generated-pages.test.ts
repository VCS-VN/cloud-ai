import { describe, it, expect } from "vitest";
import { ProjectStateStore } from "@/features/projects/legacy/project-state-store.server";
import type {
  PgProjectStateRepository,
  ProjectStateRecord,
} from "@/server/repositories/project-state-repository";
import { createEmptyProjectState } from "@/features/projects/legacy/project-state.schema";

// Minimal in-memory stand-in for PgProjectStateRepository — the store only
// calls getByProjectId + save, so we implement just those.
function createFakeRepository(): PgProjectStateRepository {
  let record: ProjectStateRecord | undefined;
  return {
    async getByProjectId(projectId: string) {
      return record && record.projectId === projectId ? record : undefined;
    },
    async save(next: ProjectStateRecord) {
      record = next;
      return next;
    },
    async list() {
      return record ? [record] : [];
    },
  } as unknown as PgProjectStateRepository;
}

describe("ProjectStateStore.appendGeneratedPage", () => {
  it("appends a new slug", async () => {
    const store = new ProjectStateStore(createFakeRepository());
    const state = await store.appendGeneratedPage("proj_1", "checkout");
    expect(state.generatedPages.map((p) => p.slug)).toEqual(["checkout"]);
  });

  it("does not duplicate an existing slug, and refreshes generatedAt", async () => {
    const store = new ProjectStateStore(createFakeRepository());
    const first = await store.appendGeneratedPage("proj_1", "checkout");
    const firstAt = first.generatedPages[0].generatedAt;
    await new Promise((r) => setTimeout(r, 2));
    const second = await store.appendGeneratedPage("proj_1", "checkout");
    expect(second.generatedPages.map((p) => p.slug)).toEqual(["checkout"]);
    expect(second.generatedPages[0].generatedAt).not.toBe(firstAt);
  });

  it("accumulates distinct slugs", async () => {
    const store = new ProjectStateStore(createFakeRepository());
    await store.appendGeneratedPage("proj_1", "home");
    const state = await store.appendGeneratedPage("proj_1", "product-detail");
    expect(state.generatedPages.map((p) => p.slug).sort()).toEqual([
      "home",
      "product-detail",
    ]);
  });

  it("createEmptyProjectState starts with no generated pages", () => {
    expect(createEmptyProjectState("proj_1").generatedPages).toEqual([]);
  });
});
