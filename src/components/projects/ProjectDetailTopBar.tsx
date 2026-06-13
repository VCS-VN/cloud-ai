import {
  CheckCircle2,
  ChevronLeft,
  Clock,
  Code2,
  Globe,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Settings,
  Share2,
  Square,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { AuthUserSummary } from "@/auth/types";
import { UserMenu } from "@/components/auth/UserMenu";
import { Button } from "@/components/ui/button";
import type { Project } from "@/shared/project-types";

type ProjectDetailTopBarProps = {
  project: Project;
  processing: boolean;
  detailMode: "preview" | "code";
  chatVisible: boolean;
  previewRunning: boolean;
  previewStopping: boolean;
  user?: AuthUserSummary;
  onModeChange: (mode: "preview" | "code") => void;
  onStopPreview: () => void;
  onOpenSettings: () => void;
  onToggleChat: () => void;
};

function projectInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ProjectDetailTopBar({
  project,
  processing,
  detailMode,
  chatVisible,
  previewRunning,
  previewStopping,
  user,
  onModeChange,
  onStopPreview,
  onOpenSettings,
  onToggleChat,
}: ProjectDetailTopBarProps) {
  return (
    <header className="project-topbar">
      <div className="flex items-center gap-3 min-w-0">
        <Link to="/dashboard" className="flex items-center gap-2 group shrink-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-deep transition-transform duration-base group-hover:-translate-y-px">
            <svg
              className="h-3.5 w-3.5 text-paper"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M4 7h16M4 12h16M4 17h10" />
            </svg>
          </span>
          <span className="font-semibold tracking-tight text-ink hidden sm:inline">
            Cloud AI
          </span>
        </Link>
        <span className="text-subtle hidden md:inline" aria-hidden="true">
          /
        </span>
        <Link
          to="/dashboard"
          className="text-ui-sm text-muted transition-colors duration-base hover:text-ink hidden md:inline truncate"
        >
          Projects
        </Link>
        <span className="text-subtle hidden md:inline" aria-hidden="true">
          /
        </span>
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 rounded-md bg-chalk border border-hairline flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-[10px] leading-none font-mono font-semibold text-ink">
              {projectInitials(project.name)}
            </span>
          </span>
          <span className="text-ui-sm font-semibold tracking-tight truncate text-ink">
            {project.name}
          </span>
          <Button
            variant="unstyled"
            type="button"
            onClick={onOpenSettings}
            className="text-subtle hover:text-ink p-0.5 shrink-0"
            title="Rename"
            aria-label="Rename project"
          >
            <Pencil aria-hidden="true" size={12} />
          </Button>
          {processing ? (
            <span className="msg-pill-warn hidden lg:inline-flex shrink-0">
              <Loader2
                aria-hidden="true"
                size={10}
                className="animate-spin"
              />
              Running
            </span>
          ) : (
            <span className="pill-success hidden lg:inline-flex shrink-0">
              <CheckCircle2 aria-hidden="true" size={10} />
              Ready
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 lg:gap-2">
        <Button
          variant="unstyled"
          type="button"
          className="project-topbar-iconbtn"
          aria-label="History"
          title="History — coming soon"
          disabled
        >
          <Clock aria-hidden="true" size={14} />
          History
        </Button>
        <Button
          variant="unstyled"
          type="button"
          onClick={onOpenSettings}
          className="project-topbar-iconbtn"
          aria-label="Settings"
        >
          <Settings aria-hidden="true" size={14} />
          Settings
        </Button>
        <Button
          variant="unstyled"
          type="button"
          onClick={onStopPreview}
          disabled={!previewRunning || previewStopping}
          className="project-topbar-iconbtn text-danger-fg disabled:text-muted"
          aria-label="Stop preview"
          title="Stop preview"
        >
          {previewStopping ? (
            <Loader2 aria-hidden="true" size={14} className="animate-spin" />
          ) : (
            <Square aria-hidden="true" size={13} />
          )}
          Stop
        </Button>
        <Button
          variant="unstyled"
          type="button"
          onClick={() => onModeChange(detailMode === "code" ? "preview" : "code")}
          className="project-topbar-outlinebtn"
          aria-pressed={detailMode === "code"}
          aria-label={detailMode === "code" ? "Switch to preview" : "Switch to code"}
        >
          {detailMode === "code" ? (
            <>
              <Globe aria-hidden="true" size={14} />
              Preview
            </>
          ) : (
            <>
              <Code2 aria-hidden="true" size={14} />
              Code
            </>
          )}
        </Button>
        <Button
          variant="unstyled"
          type="button"
          className="project-topbar-outlinebtn"
          title="Share — coming soon"
          disabled
        >
          <Share2 aria-hidden="true" size={14} />
          Share
        </Button>
        <Button
          variant="unstyled"
          type="button"
          onClick={onToggleChat}
          className="project-topbar-iconbtn"
          aria-label={chatVisible ? "Hide chat" : "Show chat"}
          title={chatVisible ? "Hide chat" : "Show chat"}
        >
          {chatVisible ? (
            <PanelLeftClose aria-hidden="true" size={14} />
          ) : (
            <PanelLeftOpen aria-hidden="true" size={14} />
          )}
        </Button>
        <span
          className="hidden md:inline-block w-px h-5 bg-hairline mx-1"
          aria-hidden="true"
        />
        <UserMenu user={user} compact placement="bottom" align="right" />
      </div>
    </header>
  );
}

export function ProjectDetailBackButton({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <Button
      variant="unstyled"
      type="button"
      onClick={onBack}
      aria-label="Back to projects"
      className="inline-flex h-7 px-2 rounded-md text-eyebrow text-muted transition-colors duration-base hover:text-ink hover:bg-ink/[0.04] focus-ring"
    >
      <ChevronLeft aria-hidden="true" size={12} />
      Projects
    </Button>
  );
}
