import { useState } from "react";
import { X } from "lucide-react";
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
  const currentProjectName = projectName ?? project?.name ?? "";
  const savedProjectName = project?.name ?? "";
  const currentSelectedStoreSlug = selectedStoreSlug ?? null;
  const savedSelectedStoreSlug = project?.selectedStoreSlug ?? null;
  const hasChanges = currentSelectedStoreSlug !== savedSelectedStoreSlug || currentProjectName.trim() !== savedProjectName;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color-mix(in_srgb,var(--color-overlay-scrim)_52%,transparent)] backdrop-blur-[2px] transition-opacity duration-200" role="dialog" aria-modal="true" aria-label="Project settings">
      <button
        className="absolute inset-0 cursor-default"
        type="button"
        aria-label="Close project settings"
        onClick={() => onOpenChange(false)}
      />
      <aside className="relative flex h-full w-full max-w-[400px] flex-col border-l border-[var(--app-border)] bg-[var(--app-bg)] shadow-2xl transition-transform duration-300 ease-out">
        <header className="flex items-start justify-between gap-sm border-b border-[var(--app-border)] p-sm">
          <div className="min-w-0">
            <p className="m-0 text-[12px] uppercase tracking-[0.08em] text-[var(--app-muted)]">
              Project settings
            </p>
            <h2 className="m-0 mt-xs truncate text-[18px] font-[580] leading-6 tracking-[-0.03em] text-[var(--app-text)]">
              {project?.name ?? "Loading project"}
            </h2>
          </div>
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close settings"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </header>

        <div className="border-b border-[var(--app-border)] px-sm pt-xs">
          <div className="inline-flex rounded-pill bg-[var(--app-control)] p-xxs">
            <ProjectSettingsTabButton active={activeTab === "general"} onClick={() => setActiveTab("general")}>General</ProjectSettingsTabButton>
            <ProjectSettingsTabButton active={activeTab === "info"} onClick={() => setActiveTab("info")}>Info</ProjectSettingsTabButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-sm">
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

        <footer className="space-y-sm border-t border-[var(--app-border)] p-sm">
          {saveError ? (
            <p className="m-0 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-danger-bg)] px-sm py-xs text-[13px] leading-5 text-[var(--app-danger-text)]">
              {saveError}
            </p>
          ) : null}
          {saveSuccess ? (
            <p className="m-0 rounded-md border border-[var(--app-border)] bg-[var(--color-block-lime)] px-sm py-xs text-[13px] leading-5 text-[var(--app-on-color-block)]">
              {saveSuccess}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-sm">
            <span className="text-[13px] text-[var(--app-muted)]">
              {hasChanges ? "Unsaved changes" : "No changes to save"}
            </span>
            <button
              className="rounded-pill bg-[var(--color-primary)] px-md py-xs text-[14px] font-[560] text-[var(--color-on-primary)] transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!hasChanges || saving}
              onClick={() => {
                if (!hasChanges || saving) return;
                void onSave?.({ name: currentProjectName.trim(), selectedStoreSlug: currentSelectedStoreSlug });
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
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
    <button
      className={`rounded-pill px-sm py-xxs text-[13px] font-[560] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] ${active ? "bg-[var(--app-selected-bg)] text-[var(--app-selected-text)]" : "text-[var(--app-muted)] hover:text-[var(--app-text)]"}`}
      type="button"
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
