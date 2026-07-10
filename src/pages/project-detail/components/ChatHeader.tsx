import { ArrowLeft, Loader2, PanelLeftClose, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "@/shared/project-types";
import { statusLabel } from "../utils";

export function ChatHeader({
  project,
  processing = false,
  onBack,
  onOpenSettings,
  onToggleChat,
}: {
  project: Project;
  processing?: boolean;
  onBack: () => void;
  onOpenSettings: () => void;
  onToggleChat: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-[rgb(var(--color-hairline))] p-2">
      <div className="flex min-w-0 items-start gap-2">
        <Button
          className="mt-xxs inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-muted))] transition-colors duration-200 hover:text-[rgb(var(--color-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-ink) / 0.2)]"
          type="button"
          onClick={onBack}
          aria-label="Back to projects"
        >
          <ArrowLeft aria-hidden="true" size={16} />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-[14px] font-[580] leading-4 tracking-[-0.015em]">
            {project.name}
          </h1>

          <div className="mt-1 flex flex-wrap gap-1 text-[12px] leading-4 text-[rgb(var(--color-muted))]">
            <span className="rounded-pill bg-[rgb(var(--color-chalk))] px-1 py-xxs">
              {project.status !== 0 ? statusLabel[project.status] : "Inactive"}
            </span>
            {processing ? (
              <span className="inline-flex items-center gap-0.5 rounded-pill bg-[var(--color-block-lime)] px-1 py-xxs text-[rgb(var(--color-paper))]">
                <Loader2
                  aria-hidden="true"
                  className="animate-spin text-[rgb(var(--color-paper))]"
                  size={12}
                />
                Agent working
              </span>
            ) : null}
            <span className="rounded-pill bg-[rgb(var(--color-chalk))] px-1 py-xxs">
              Edited {new Date(project.updatedAt).toLocaleDateString("en-US")}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-muted))] transition-colors duration-200 hover:text-[rgb(var(--color-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-ink) / 0.2)]"
            type="button"
            onClick={onOpenSettings}
            aria-label="Open project settings"
          >
            <Settings aria-hidden="true" size={16} />
          </Button>
          <Button
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-muted))] transition-colors duration-200 hover:text-[rgb(var(--color-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-ink) / 0.2)]"
            type="button"
            onClick={onToggleChat}
            aria-label="Hide chat"
          >
            <PanelLeftClose aria-hidden="true" size={16} />
          </Button>
        </div>
      </div>
    </header>
  );
}
