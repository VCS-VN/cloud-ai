import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Clock3,
  FolderKanban,
  Grid2X2,
  Home,
  List,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sparkles,
  Star,
  UserRound,
  X,
} from "lucide-react";
import { EmptyState } from "../../components/common/EmptyState";
import { ProjectList } from "../../components/projects/ProjectList";
import type { Project } from "../../features/storefront-builder/types";
import { UserMenu } from "../../components/auth/UserMenu";
import { getCurrentUser } from "../../server/functions/auth";
import { getProjectWorkspace } from "../../server/functions/projects";
import { useTheme, type AppTheme } from "../../theme";

type ProjectFilter = "all" | "recent" | "ready" | "draft" | "failed";
type ViewMode = "grid" | "list";

const SIDEBAR_COLLAPSED_KEY = "projects-sidebar-collapsed";

const projectFilters: Array<{
  key: ProjectFilter;
  label: string;
  icon: typeof FolderKanban;
}> = [
  { key: "all", label: "All projects", icon: Grid2X2 },
  { key: "recent", label: "Recently edited", icon: Clock3 },
  { key: "ready", label: "Ready", icon: Star },
  { key: "draft", label: "Drafts", icon: FolderKanban },
  { key: "failed", label: "Needs review", icon: AlertCircle },
];

export const Route = createFileRoute("/projects/")({
  beforeLoad: async () => {
    const { user } = await getCurrentUser()
    if (!user) throw redirect({ to: "/" })
    return { user }
  },
  loader: () => getProjectWorkspace({ data: {} }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const navigate = useNavigate();
  const { projects } = Route.useLoaderData();
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [projectSearch, setProjectSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  const filteredProjects = useMemo(
    () => filterProjects(projects, projectFilter, projectSearch),
    [projects, projectFilter, projectSearch],
  );
  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 7),
    [projects],
  );

  function openProject(projectId: string) {
    void navigate({ to: "/projects/$projectId", params: { projectId } });
  }

  function goHome() {
    void navigate({ to: "/" });
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--app-bg)] p-xs text-[var(--app-text)] sm:p-sm">
      <div
        className={`grid min-h-[calc(100vh-16px)] gap-sm transition-[grid-template-columns] duration-200 ${collapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[290px_minmax(0,1fr)]"}`}
      >
        <aside className="flex min-w-0 flex-col rounded-sm border border-[var(--app-border)] bg-[var(--app-panel-strong)] p-sm text-[var(--app-text)]">
          <div className="mb-md flex items-center justify-between gap-sm">
            <button
              className="flex min-w-0 items-center gap-xs border-0 bg-transparent p-0 text-left text-[12px] font-[520] text-[var(--app-text)]"
              type="button"
              onClick={goHome}
              aria-label="Home"
            >
              <span
                className="h-5 w-5 shrink-0 rounded-sm bg-gradient-to-br from-coral via-magenta to-lilac"
                aria-hidden="true"
              />
              {!collapsed ? <span className="truncate">Cloud AI</span> : null}
            </button>
            <button
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
              type="button"
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden="true" size={16} />
              ) : (
                <PanelLeftClose aria-hidden="true" size={16} />
              )}
            </button>
          </div>

          <SidebarSection title="Projects" collapsed={collapsed}>
            {projectFilters.map((filter) => (
              <SidebarButton
                key={filter.key}
                icon={filter.icon}
                label={filter.label}
                count={countProjects(projects, filter.key)}
                selected={projectFilter === filter.key}
                collapsed={collapsed}
                onClick={() => setProjectFilter(filter.key)}
              />
            ))}
          </SidebarSection>

          <SidebarSection title="Profile" collapsed={collapsed}>
            <SidebarButton
              icon={UserRound}
              label="Profile"
              collapsed={collapsed}
              onClick={() => setSettingsOpen(true)}
            />
            <div className={collapsed ? "mt-xs flex justify-center" : "mt-xs"}>
              <UserMenu compact={collapsed} onProfile={() => setSettingsOpen(true)} />
            </div>
            <SidebarButton
              icon={Home}
              label="Home"
              collapsed={collapsed}
              onClick={goHome}
            />
          </SidebarSection>

          <SidebarSection
            title="Recents"
            collapsed={collapsed}
            className="min-h-0 flex-1 overflow-hidden"
          >
            <div className="flex min-h-0 flex-col gap-xxs overflow-y-auto pr-xxs">
              {recentProjects.map((project) => (
                <SidebarButton
                  key={project.id}
                  icon={Clock3}
                  label={project.name}
                  collapsed={collapsed}
                  onClick={() => openProject(project.id)}
                />
              ))}
            </div>
          </SidebarSection>

          {!collapsed ? (
            <div className="mt-auto rounded-sm border border-[var(--app-border)] bg-[var(--app-control)] p-sm">
              <p className="m-0 text-[12px] font-[520]">Create faster</p>
              <p className="m-0 mt-xxs text-[12px] leading-4 text-[var(--app-muted)]">
                Use prompts to turn ideas into editable website projects.
              </p>
            </div>
          ) : null}
        </aside>

        <section className="min-w-0 rounded-sm bg-[var(--app-surface)] p-sm sm:p-md">
          <header className="mb-md flex flex-col gap-sm xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="m-0 text-[20px] font-[580] leading-tight tracking-[-0.015em]">
                Projects
              </h1>
              <p className="m-0 mt-xxs text-[12px] leading-4 text-[var(--app-muted)]">
                Manage your AI website projects.
              </p>
            </div>
            <button
              className="builder-button bg-[var(--app-text)] text-[var(--app-bg)]"
              type="button"
              onClick={goHome}
            >
              <Plus aria-hidden="true" size={15} />
              Create
            </button>
          </header>

          <div className="mb-md flex flex-col gap-xs xl:flex-row xl:items-center">
            <label className="relative min-w-0 flex-1" htmlFor="project-search">
              <span className="sr-only">Search projects</span>
              <Search
                className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-[var(--app-subtle)]"
                aria-hidden="true"
                size={16}
              />
              <input
                id="project-search"
                className="h-9 w-full rounded-sm border border-[var(--app-border)] bg-[var(--app-control)] py-xs pl-9 pr-sm text-[12px] text-[var(--app-text)] outline-none placeholder:text-[var(--app-subtle)] focus:border-[var(--app-border-strong)]"
                value={projectSearch}
                placeholder="Search projects..."
                onChange={(event) => setProjectSearch(event.target.value)}
              />
            </label>
            <div className="flex items-center gap-xs">
              <button
                className="inline-flex h-9 items-center gap-xs rounded-sm border border-[var(--app-border)] bg-[var(--app-control)] px-sm text-[12px] text-[var(--app-muted)]"
                type="button"
              >
                Last edited
              </button>
              <button
                className={`inline-flex h-9 w-9 items-center justify-center rounded-sm border border-[var(--app-border)] ${viewMode === "grid" ? "bg-[var(--app-text)] text-[var(--app-bg)]" : "bg-transparent text-[var(--app-muted)]"}`}
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <Grid2X2 aria-hidden="true" size={16} />
              </button>
              <button
                className={`inline-flex h-9 w-9 items-center justify-center rounded-sm border border-[var(--app-border)] ${viewMode === "list" ? "bg-[var(--app-text)] text-[var(--app-bg)]" : "bg-transparent text-[var(--app-muted)]"}`}
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                <List aria-hidden="true" size={16} />
              </button>
            </div>
          </div>

          <p className="mb-sm mt-0 text-[12px] font-[520] text-[var(--app-muted)]">
            {projectFilter === "recent" ? "Recently edited" : "Projects"} ·{" "}
            {filteredProjects.length}
          </p>
          <ProjectList
            projects={filteredProjects}
            searchQuery={projectSearch}
            variant={viewMode}
            onSelectProject={openProject}
            onCreateProject={goHome}
            onClearSearch={() => setProjectSearch("")}
          />
        </section>
      </div>
      {settingsOpen ? (
        <ProfileSettingsModal
          theme={theme}
          onThemeChange={setTheme}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </main>
  );
}

function SidebarSection({
  title,
  collapsed,
  className = "",
  children,
}: {
  title: string;
  collapsed: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`mb-md ${className}`} aria-label={title}>
      {!collapsed ? (
        <p className="mb-xs mt-0 px-xs text-[12px] font-[520] text-[var(--app-subtle)]">
          {title}
        </p>
      ) : null}
      <div className="flex flex-col gap-xxs">{children}</div>
    </section>
  );
}

function SidebarButton({
  icon: Icon,
  label,
  count,
  selected = false,
  collapsed,
  onClick,
}: {
  icon: typeof FolderKanban;
  label: string;
  count?: number;
  selected?: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex h-9 w-full min-w-0 items-center gap-sm rounded-sm border-0 px-sm text-left text-[12px] transition ${selected ? "bg-[color-mix(in_srgb,var(--app-accent)_22%,transparent)] text-[var(--app-text)]" : "bg-transparent text-[var(--app-muted)] hover:bg-[var(--app-control)] hover:text-[var(--app-text)]"} ${collapsed ? "justify-center px-0" : ""}`}
      type="button"
      title={collapsed ? label : undefined}
      aria-label={label}
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="shrink-0" size={16} />
      {!collapsed ? (
        <span className="min-w-0 flex-1 truncate">{label}</span>
      ) : null}
      {!collapsed && typeof count === "number" ? (
        <span className="font-mono text-[12px] text-[var(--app-subtle)]">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function filterProjects(
  projects: Project[],
  filter: ProjectFilter,
  query: string,
): Project[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN");
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  return projects.filter((project) => {
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "recent"
          ? now - new Date(project.updatedAt).getTime() <= sevenDays
          : project.status === filter;

    if (!matchesFilter) return false;
    if (!normalizedQuery) return true;

    const searchable =
      `${project.name} ${project.description ?? ""} ${project.initialPrompt}`.toLocaleLowerCase(
        "vi-VN",
      );
    return searchable.includes(normalizedQuery);
  });
}

function countProjects(projects: Project[], filter: ProjectFilter): number {
  return filterProjects(projects, filter, "").length;
}

function ProfileSettingsModal({
  theme,
  onThemeChange,
  onClose,
}: {
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/58 p-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-settings-title"
      onMouseDown={onClose}
    >
      <section
        className="w-full max-w-sm rounded-sm border border-[var(--app-border)] bg-[var(--app-panel)] p-md text-[var(--app-text)] shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-md flex items-start justify-between gap-md">
          <div>
            <p className="builder-kicker text-[var(--app-subtle)]">Profile</p>
            <h2
              id="profile-settings-title"
              className="m-0 mt-xs text-[18px] font-[580] leading-tight tracking-[-0.015em]"
            >
              Settings
            </h2>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-muted)]"
            type="button"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <div className="rounded-sm border border-[var(--app-border)] bg-[var(--app-control)] p-sm">
          <p className="m-0 text-[12px] font-[520]">Theme</p>
          <p className="m-0 mt-xxs text-[12px] leading-4 text-[var(--app-muted)]">
            Apply theme to the entire builder UI.
          </p>
          <div className="mt-sm grid grid-cols-2 gap-xs rounded-sm bg-[var(--app-panel-strong)] p-xxs">
            {(["dark", "light"] as const).map((nextTheme) => (
              <button
                key={nextTheme}
                className={`h-8 rounded-sm border-0 text-[12px] capitalize ${theme === nextTheme ? "bg-[var(--app-accent)] text-white" : "bg-transparent text-[var(--app-muted)]"}`}
                type="button"
                onClick={() => onThemeChange(nextTheme)}
              >
                {nextTheme}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
