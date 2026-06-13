import type { Project } from "@/shared/project-types";
import type { DevRuntimeUIState } from "./agent-event-reducer";

export type PreviewAvailabilityInput = {
  projectStatus: Project["status"];
  runtimeStatus: DevRuntimeUIState["status"];
  previewUrl?: string | null;
};

export function isProjectPreviewStartAvailable(input: PreviewAvailabilityInput) {
  return input.projectStatus === "ready"
    && ["idle", "stopped", "error"].includes(input.runtimeStatus);
}

export function isProjectPreviewTemporarilyUnavailable(input: Pick<PreviewAvailabilityInput, "projectStatus">) {
  return input.projectStatus === "generating" || input.projectStatus === "draft";
}
