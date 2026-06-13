import { describe, expect, it } from "vitest";
import {
  isProjectPreviewStartAvailable,
  isProjectPreviewTemporarilyUnavailable,
} from "@/features/agents/ui/preview-availability";

describe("isProjectPreviewStartAvailable", () => {
  it("allows starting a stopped preview even when a previous previewUrl is stored", () => {
    expect(
      isProjectPreviewStartAvailable({
        projectStatus: "ready",
        runtimeStatus: "stopped",
        previewUrl: "https://project-preview.example.com",
      }),
    ).toBe(true);
  });

  it("allows starting while the agent is processing a separate task", () => {
    expect(
      isProjectPreviewStartAvailable({
        projectStatus: "ready",
        runtimeStatus: "stopped",
        previewUrl: "https://project-preview.example.com",
      }),
    ).toBe(true);
  });
});

describe("isProjectPreviewTemporarilyUnavailable", () => {
  it("only blocks preview while the project lifecycle is not ready", () => {
    expect(isProjectPreviewTemporarilyUnavailable({ projectStatus: "draft" })).toBe(true);
    expect(isProjectPreviewTemporarilyUnavailable({ projectStatus: "generating" })).toBe(true);
    expect(isProjectPreviewTemporarilyUnavailable({ projectStatus: "ready" })).toBe(false);
  });
});
