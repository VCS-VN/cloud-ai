import { describe, expect, it } from "vitest";
import { resolveBuilderRunKind } from "@/features/agents/codex/runtime/update-classifier.server";
import type { Project } from "@/shared/project-types";

function project(status: Project["status"]): Pick<Project, "status"> {
  return { status };
}

describe("resolveBuilderRunKind (R5)", () => {
  it("empty workspace → init regardless of prompt", () => {
    expect(
      resolveBuilderRunKind({
        project: project("ready"),
        workspaceFiles: [],
        prompt: "thêm image vào hero",
      }),
    ).toBe("init");
  });

  it("project.status === 'draft' → init even if workspace is non-empty", () => {
    expect(
      resolveBuilderRunKind({
        project: project("draft"),
        workspaceFiles: ["src/routes/index.tsx"],
        prompt: "đổi màu nút",
      }),
    ).toBe("init");
  });

  it("populated + ready project + benign prompt → update", () => {
    expect(
      resolveBuilderRunKind({
        project: project("ready"),
        workspaceFiles: ["src/routes/index.tsx", "src/components/storefront/Hero.tsx"],
        prompt: "thêm image vào hero",
      }),
    ).toBe("update");
  });

  it("populated project + new-route prompt → new_route", () => {
    expect(
      resolveBuilderRunKind({
        project: project("ready"),
        workspaceFiles: ["src/routes/index.tsx"],
        prompt: "Add a new page /promotions",
      }),
    ).toBe("new_route");
  });

  it("populated project + unsupported prompt (mentions blocked path) → unsupported", () => {
    expect(
      resolveBuilderRunKind({
        project: project("ready"),
        workspaceFiles: ["src/routes/index.tsx"],
        prompt: "edit package.json",
      }),
    ).toBe("unsupported");
  });

  it("populated project + unsupported intent (config change) → unsupported", () => {
    expect(
      resolveBuilderRunKind({
        project: project("ready"),
        workspaceFiles: ["src/routes/index.tsx"],
        prompt: "change vite.config to enable PWA",
      }),
    ).toBe("unsupported");
  });
});
