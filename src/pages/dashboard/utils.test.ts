import { describe, expect, it } from "vitest";
import type { Project, ProjectStatus } from "@/shared/project-types";
import { filterProjects, matchesFilter, sortProjects } from "./utils";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    name: "Project",
    initialPrompt: "",
    status: "draft",
    processingStatus: "idle",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    pwa: {
      enabled: false,
      name: "",
      shortName: "",
      themeColor: "#000000",
      backgroundColor: "#ffffff",
      display: "standalone",
      startUrl: "/",
      scope: "/",
      icons: [],
      offlineFallbackEnabled: false,
    },
    ...overrides,
  };
}

describe("matchesFilter", () => {
  it("matches every project for the 'all' filter", () => {
    const statuses: ProjectStatus[] = [0, "draft", "generating", "ready", "failed"];
    for (const status of statuses) {
      expect(matchesFilter(makeProject({ status }), "all")).toBe(true);
    }
  });

  it("treats ready and generating as active", () => {
    expect(matchesFilter(makeProject({ status: "ready" }), "active")).toBe(true);
    expect(matchesFilter(makeProject({ status: "generating" }), "active")).toBe(true);
    expect(matchesFilter(makeProject({ status: "draft" }), "active")).toBe(false);
  });

  it("treats draft and legacy 0 status as draft", () => {
    expect(matchesFilter(makeProject({ status: "draft" }), "draft")).toBe(true);
    expect(matchesFilter(makeProject({ status: 0 }), "draft")).toBe(true);
    expect(matchesFilter(makeProject({ status: "ready" }), "draft")).toBe(false);
  });

  it("treats failed as archived", () => {
    expect(matchesFilter(makeProject({ status: "failed" }), "archived")).toBe(true);
    expect(matchesFilter(makeProject({ status: "ready" }), "archived")).toBe(false);
  });
});

describe("filterProjects", () => {
  it("returns only the projects matching the filter", () => {
    const projects = [
      makeProject({ id: "a", status: "ready" }),
      makeProject({ id: "b", status: "draft" }),
      makeProject({ id: "c", status: "failed" }),
      makeProject({ id: "d", status: "generating" }),
    ];
    expect(filterProjects(projects, "active").map((p) => p.id)).toEqual(["a", "d"]);
    expect(filterProjects(projects, "draft").map((p) => p.id)).toEqual(["b"]);
    expect(filterProjects(projects, "archived").map((p) => p.id)).toEqual(["c"]);
    expect(filterProjects(projects, "all")).toHaveLength(4);
  });
});

describe("sortProjects", () => {
  const projects = [
    makeProject({
      id: "old",
      name: "Zeta",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    }),
    makeProject({
      id: "new",
      name: "Alpha",
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    }),
  ];

  it("sorts by most recently modified first", () => {
    expect(sortProjects(projects, "modified").map((p) => p.id)).toEqual(["old", "new"]);
  });

  it("sorts by most recently created first", () => {
    expect(sortProjects(projects, "created").map((p) => p.id)).toEqual(["new", "old"]);
  });

  it("sorts by name case-insensitively", () => {
    expect(sortProjects(projects, "name").map((p) => p.id)).toEqual(["new", "old"]);
  });

  it("does not mutate the input array", () => {
    const input = [...projects];
    sortProjects(input, "name");
    expect(input.map((p) => p.id)).toEqual(["old", "new"]);
  });
});
