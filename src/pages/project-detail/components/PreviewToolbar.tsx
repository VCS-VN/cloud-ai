import {
  Code2,
  ExternalLink,
  Globe,
  Laptop,
  Loader2,
  RefreshCw,
  Smartphone,
  Square,
  Tablet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isProjectPreviewTemporarilyUnavailable } from "@/features/agents/ui/preview-availability";
import type { DevRuntimeUIState } from "@/features/agents/ui/agent-event-reducer";
import type { Project } from "@/shared/project-types";
import type { PreviewDevice } from "../utils";

export function PreviewToolbar({
  previewDraftPath,
  previewPathError,
  previewReady,
  previewControlsLoading,
  activePreviewUrl,
  runtimeState,
  previewStopping,
  projectStatus,
  activeDevice,
  onDeviceChange,
  onPathChange,
  onPathSubmit,
  onPathReset,
  onStopPreview,
}: {
  previewDraftPath: string;
  previewPathError: string | null;
  previewReady: boolean;
  previewControlsLoading: boolean;
  activePreviewUrl: string | null;
  runtimeState: DevRuntimeUIState;
  previewStopping: boolean;
  projectStatus: Project["status"];
  activeDevice: PreviewDevice;
  onDeviceChange: (device: PreviewDevice) => void;
  onPathChange: (path: string) => void;
  onPathSubmit: () => void;
  onPathReset: () => void;
  onStopPreview: () => void;
}) {
  const previewTemporarilyUnavailable = isProjectPreviewTemporarilyUnavailable({
    projectStatus,
  });
  const pathInputId = "preview-path";
  // const versionLabel = "v12";
  // const lastBuildLabel =
  //   runtimeState.status === "running" ? "last build 23s ago" : "no preview";

  return (
    <header className="preview-toolbar">
      {/* Left: Device toggle */}
      <div className="flex items-center gap-2">
        <div
          className="preview-device-group"
          role="group"
          aria-label="Device preview"
        >
          <Button
            variant="unstyled"
            type="button"
            className={`preview-device-btn ${activeDevice === "desktop" ? "preview-device-btn-active" : ""}`}
            onClick={() => onDeviceChange("desktop")}
            aria-label="Desktop"
            aria-pressed={activeDevice === "desktop"}
            title="Desktop"
          >
            <Laptop aria-hidden="true" size={14} />
          </Button>
          <Button
            variant="unstyled"
            type="button"
            className={`preview-device-btn ${activeDevice === "tablet" ? "preview-device-btn-active" : ""}`}
            onClick={() => onDeviceChange("tablet")}
            aria-label="Tablet"
            aria-pressed={activeDevice === "tablet"}
            title="Tablet"
          >
            <Tablet aria-hidden="true" size={14} />
          </Button>
          <Button
            variant="unstyled"
            type="button"
            className={`preview-device-btn ${activeDevice === "mobile" ? "preview-device-btn-active" : ""}`}
            onClick={() => onDeviceChange("mobile")}
            aria-label="Mobile"
            aria-pressed={activeDevice === "mobile"}
            title="Mobile"
          >
            <Smartphone aria-hidden="true" size={14} />
          </Button>
        </div>
      </div>

      {/* Center: URL pill */}
      <div
        className="preview-url-pill"
        data-error={previewPathError ? "true" : undefined}
      >
        <Globe aria-hidden="true" size={14} className="preview-url-icon" />
        <label htmlFor={pathInputId} className="flex-1 min-w-0">
          <Input
            id={pathInputId}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-ui-sm text-ink outline-none placeholder:text-subtle disabled:cursor-not-allowed disabled:text-muted"
            value={previewDraftPath}
            placeholder="/ — type a path, press Enter"
            disabled={!previewReady}
            aria-invalid={previewPathError ? "true" : undefined}
            onChange={(event) => onPathChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onPathSubmit();
              if (event.key === "Escape") onPathReset();
            }}
          />
        </label>
        {/* {previewPathError ? (
          <span
            className="text-eyebrow text-danger-fg shrink-0 truncate max-w-[200px]"
            title={previewPathError}
          >
            {previewPathError}
          </span>
        ) : (
          <>
            <span className="preview-url-meta font-mono">{versionLabel}</span>
            <span
              aria-hidden="true"
              className="w-px h-3 bg-hairline shrink-0"
            />
            <span
              className="preview-url-status-dot"
              data-live={runtimeState.status === "running" ? "true" : undefined}
            />
            <span className="preview-url-meta">{lastBuildLabel}</span>
          </>
        )} */}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {previewTemporarilyUnavailable ? (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-chalk px-2 text-eyebrow text-muted">
            <Loader2 aria-hidden="true" className="animate-spin" size={12} />
            Building…
          </span>
        ) : null}
        <Button
          variant="unstyled"
          type="button"
          onClick={onPathSubmit}
          disabled={!previewReady || previewControlsLoading || previewStopping}
          aria-label="Reload preview"
          title="Reload preview"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-ink hover:bg-ink/[0.04] transition-colors duration-base"
        >
          {previewControlsLoading ? (
            <Loader2 aria-hidden="true" className="animate-spin" size={14} />
          ) : (
            <RefreshCw aria-hidden="true" size={14} />
          )}
        </Button>
        <Button
          variant="unstyled"
          type="button"
          onClick={onStopPreview}
          disabled={runtimeState.status !== "running" || previewStopping}
          aria-label="Stop preview"
          title="Stop preview"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-danger-bg hover:text-danger-fg disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-base"
        >
          {previewStopping ? (
            <Loader2 aria-hidden="true" className="animate-spin" size={14} />
          ) : (
            <Square aria-hidden="true" size={13} />
          )}
        </Button>
        <Button
          variant="unstyled"
          type="button"
          disabled
          aria-label="Inspect"
          title="Inspect — coming soon"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted opacity-60"
        >
          <Code2 aria-hidden="true" size={14} />
        </Button>
        {activePreviewUrl ? (
          <a
            href={activePreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-ink hover:bg-ink/[0.04] transition-colors duration-base"
            aria-label="Open preview in new tab"
            title="Open preview"
          >
            <ExternalLink aria-hidden="true" size={14} />
          </a>
        ) : (
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted opacity-60"
            aria-label="Open preview"
            title="Preview not available"
          >
            <ExternalLink aria-hidden="true" size={14} />
          </span>
        )}
      </div>
    </header>
  );
}
