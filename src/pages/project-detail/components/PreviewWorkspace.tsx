import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { PreviewInitPanel } from "@/components/projects/PreviewInitPanel";
import { Button } from "@/components/ui/button";
import { isProjectPreviewTemporarilyUnavailable } from "@/features/agents/ui/preview-availability";
import type { DevRuntimeUIState } from "@/features/agents/ui/agent-event-reducer";
import type { Project } from "@/shared/project-types";
import type { PreviewDevice, PreviewTokenState } from "../utils";

export function PreviewWorkspace({
  previewUrl,
  previewReloadKey,
  activeDevice,
  runtimeState,
  projectId,
  previewStarting,
  projectStatus,
  previewTokenState,
  previewStartError,
  onStartPreview,
  onRefreshPreviewToken,
}: {
  previewUrl: string | null;
  previewReloadKey: number;
  activeDevice: PreviewDevice;
  runtimeState: DevRuntimeUIState;
  projectId: string;
  previewStarting: boolean;
  projectStatus: Project["status"];
  previewTokenState: PreviewTokenState;
  previewStartError: string | null;
  onStartPreview: () => void;
  onRefreshPreviewToken: () => void;
}) {
  const showIframe = !!previewUrl;
  const deviceWidth =
    activeDevice === "mobile"
      ? 390
      : activeDevice === "tablet"
        ? 820
        : null;
  const previewTemporarilyUnavailable = isProjectPreviewTemporarilyUnavailable({
    projectStatus,
  });
  const showInitPanel =
    !previewTemporarilyUnavailable &&
    ["idle", "stopped", "error"].includes(runtimeState.status) &&
    runtimeState.status !== "running";
  return (
    <section className="preview-theme-isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-paper transition-colors duration-300">
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-paper transition-colors duration-300 ${
          deviceWidth ? "items-center py-3" : ""
        }`}
      >
        {showIframe ? (
          <iframe
            key={`${previewUrl}:${previewTokenState.refreshedAt ?? "ready"}:${previewReloadKey}`}
            src={previewUrl}
            className={`h-full w-full border-0 transition-[max-width] duration-300 ${
              deviceWidth
                ? "rounded-lg border border-hairline bg-surface shadow-sm"
                : ""
            }`}
            style={{
              colorScheme: "light",
              backgroundColor: "rgb(var(--color-surface))",
              maxWidth: deviceWidth ? `${deviceWidth}px` : undefined,
            }}
            title="Project preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : runtimeState.status === "running" &&
          runtimeState.previewUrl &&
          previewTokenState.status === "refreshing" ? (
          <div className="flex h-full items-center justify-center text-sm text-[rgb(var(--color-muted))]">
            Preparing secure preview access…
          </div>
        ) : runtimeState.status === "running" &&
          runtimeState.previewUrl &&
          previewTokenState.status === "failed" ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-[rgb(var(--color-muted))]">
            <div className="max-w-sm space-y-2 rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-surface))] p-4">
              <TriangleAlert
                className="mx-auto text-[rgb(var(--color-ink))]"
                aria-hidden="true"
                size={22}
              />
              <p className="m-0 font-[560] text-[rgb(var(--color-ink))]">
                Could not prepare secure preview access.
              </p>
              <p className="m-0 text-[12px] leading-5">
                {previewTokenState.error ?? "Unable to refresh preview access."}
              </p>
              <p className="m-0 text-[11px] leading-4 text-[rgb(var(--color-muted))]">
                Runtime is running and preview URL is available. Token refresh
                failed.
              </p>
              <Button
                type="button"
                onClick={onRefreshPreviewToken}
                className="inline-flex items-center gap-0.5 rounded-pill border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] px-2 py-1 text-[12px] font-[520] text-[rgb(var(--color-ink))] hover:border-[rgb(var(--color-hairline-soft))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-ink) / 0.2)]"
              >
                <RefreshCw aria-hidden="true" size={13} />
                Retry secure access
              </Button>
            </div>
          </div>
        ) : previewTemporarilyUnavailable ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-[rgb(var(--color-muted))]">
            <div className="max-w-sm space-y-1 rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-surface))] p-4">
              <Loader2
                className="mx-auto animate-spin text-[rgb(var(--color-muted))]"
                aria-hidden="true"
                size={22}
              />
              <p className="m-0 font-[560] text-[rgb(var(--color-ink))]">
                Your storefront is being prepared.
              </p>
              <p className="m-0 text-[12px] leading-5">
                Preview will be available when setup is complete.
              </p>
            </div>
          </div>
        ) : showInitPanel ? (
          <PreviewInitPanel
            projectId={projectId}
            onStartPreview={onStartPreview}
            isLoading={previewStarting}
            error={previewStartError ?? runtimeState.error}
            onRetry={onStartPreview}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-[rgb(var(--color-muted))]">
            Start preview when your storefront is ready.
          </div>
        )}
      </div>
    </section>
  );
}
