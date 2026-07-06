import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectSettingsGeneralTab } from "@/components/projects/ProjectSettingsGeneralTab";
import { ProjectSettingsInfoTab } from "@/components/projects/ProjectSettingsInfoTab";
import type { Project } from "@/shared/project-types";

type ProjectSettingsTab = "general" | "info";

export function ProjectSettingsDrawer({
  open,
  project,
  loading = false,
  projectName,
  selectedStoreSlug,
  onProjectNameChange,
  onSelectedStoreChange,
  deleting = false,
  onDelete,
  saving = false,
  saveError,
  saveSuccess,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  project?: Project;
  loading?: boolean;
  projectName?: string;
  selectedStoreSlug?: string | null;
  onProjectNameChange?: (name: string) => void;
  onSelectedStoreChange?: (storeId: string | null) => void;
  deleting?: boolean;
  onDelete?: () => void;
  saving?: boolean;
  saveError?: string | null;
  saveSuccess?: string | null;
  onOpenChange: (open: boolean) => void;
  onSave?: (settings: { name?: string; selectedStoreSlug?: string | null }) => void | Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<ProjectSettingsTab>("general");
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const currentProjectName = projectName ?? project?.name ?? "";
  const savedProjectName = project?.name ?? "";
  const currentSelectedStoreSlug = selectedStoreSlug ?? null;
  const savedSelectedStoreSlug = project?.selectedStoreSlug ?? null;
  const hasChanges = currentSelectedStoreSlug !== savedSelectedStoreSlug || currentProjectName.trim() !== savedProjectName;

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted, onOpenChange]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] flex justify-end bg-black/40 backdrop-blur-sm transition-opacity duration-200 ease-standard ${visible ? "opacity-100" : "opacity-0"}`}
      role="dialog"
      aria-modal="true"
      aria-label="Project settings"
    >
      <Button
        variant="unstyled"
        className="absolute inset-0 cursor-default"
        type="button"
        aria-label="Close project settings"
        onClick={() => onOpenChange(false)}
      />
      <aside className={`relative flex h-full w-full max-w-[420px] flex-col overflow-hidden border-l border-hairline bg-paper text-ink shadow-2xl transition-transform duration-300 ease-standard ${visible ? "translate-x-0" : "translate-x-full"}`}>
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-paper px-5">
          <div className="min-w-0">
            <p className="m-0 text-eyebrow font-mono uppercase tracking-wide text-subtle">
              Project settings
            </p>
            <h2 className="m-0 mt-0.5 truncate text-ui font-semibold tracking-tight text-ink">
              {project?.name ?? "Loading project"}
            </h2>
          </div>
          <Button
            variant="unstyled"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface text-muted transition-colors duration-base hover:border-hairline-soft hover:text-ink focus-ring"
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close settings"
          >
            <X aria-hidden="true" size={16} />
          </Button>
        </header>

        <div className="shrink-0 border-b border-hairline bg-paper px-5 py-3">
          <div className="inline-flex rounded-lg border border-hairline bg-chalk p-0.5">
            <ProjectSettingsTabButton active={activeTab === "general"} onClick={() => setActiveTab("general")}>General</ProjectSettingsTabButton>
            <ProjectSettingsTabButton active={activeTab === "info"} onClick={() => setActiveTab("info")}>Info</ProjectSettingsTabButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-paper p-5">
          {activeTab === "general" ? (
            <ProjectSettingsGeneralTab
              project={project}
              projectName={currentProjectName}
              loading={loading}
              onProjectNameChange={onProjectNameChange}
              deleting={deleting}
              onDelete={onDelete}
            />
          ) : (
            <ProjectSettingsInfoTab
              active={activeTab === "info"}
              selectedStoreSlug={currentSelectedStoreSlug}
              onSelectedStoreChange={onSelectedStoreChange}
            />
          )}
        </div>

        <footer className="shrink-0 space-y-3 border-t border-hairline bg-paper px-5 py-4">
          {saveError ? (
            <p className="m-0 rounded-md border border-danger-bg bg-danger-bg px-3 py-2 text-ui-sm leading-5 text-danger-fg">
              {saveError}
            </p>
          ) : null}
          {saveSuccess ? (
            <p className="m-0 rounded-md border border-success-bg bg-success-bg px-3 py-2 text-ui-sm leading-5 text-success-fg">
              {saveSuccess}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-ui-sm text-muted">
              {hasChanges ? "Unsaved changes" : "No changes to save"}
            </span>
            <Button
              variant="unstyled"
              className="inline-flex h-9 shrink-0 items-center rounded-md bg-ink px-4 text-ui-sm font-semibold text-paper transition-colors duration-base hover:bg-deep disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              disabled={!hasChanges || saving}
              onClick={() => {
                if (!hasChanges || saving) return;
                void onSave?.({ name: currentProjectName.trim(), selectedStoreSlug: currentSelectedStoreSlug });
              }}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function ProjectSettingsTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="unstyled"
      className={`inline-flex h-7 items-center rounded-md px-3 text-eyebrow font-medium transition-all duration-base focus-ring ${active ? "bg-surface text-ink shadow-sm" : "text-muted hover:bg-ink/[0.035] hover:text-ink"}`}
      type="button"
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </Button>
  );
}
