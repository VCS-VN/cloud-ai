import type { Project } from "@/shared/project-types";
import type { DevRuntimeUIState } from "./agent-event-reducer";

export type PreviewAvailabilityInput = {
  projectStatus: Project["status"];
  projectProcessingStatus: Project["processingStatus"];
  runtimeStatus: DevRuntimeUIState["status"];
  previewUrl?: string | null;
};

export function isProjectPreviewStartAvailable(input: PreviewAvailabilityInput) {
  return input.projectStatus === "ready"
    && input.projectProcessingStatus !== "processing"
    && !input.previewUrl
    && ["idle", "stopped", "error"].includes(input.runtimeStatus);
}

export function isProjectPreviewTemporarilyUnavailable(input: Pick<PreviewAvailabilityInput, "projectStatus" | "projectProcessingStatus">) {
  return input.projectProcessingStatus === "processing" || input.projectStatus === "generating" || input.projectStatus === "draft";
}
