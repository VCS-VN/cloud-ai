import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Bell,
  ChevronDown,
  FileText,
  Grid2X2,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import classnames from "classnames";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ModelPicker } from "@/components/projects/ModelPicker";
import { useTheme, type AppTheme } from "@/theme";
import { getCurrentUser, logout } from "@/server/functions/auth";
import {
  createProjectFromPrompt,
  deleteProject,
  getProjectWorkspace,
} from "@/server/functions/projects";
import type { Project } from "@/shared/project-types";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw redirect({ to: "/" as never });
    return { user };
  },
  loader: () => getProjectWorkspace({ data: {} }),
  component: DashboardPage,
});

const SUGGESTIONS = [
  "B2B SaaS landing page",
  "Handmade online store",
  "Photography portfolio",
  "Event page",
] as const;

const SELECTED_MODEL_KEY = "project-detail-selected-model";

function DashboardPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const createProject = useServerFn(createProjectFromPrompt);
  const removeProject = useServerFn(deleteProject);

  const { projects } = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("lumen.dashboard.sidebar");
    setIsSidebarExpanded(stored === "expanded");
    const savedModel = window.localStorage.getItem(SELECTED_MODEL_KEY);
    if (savedModel) setSelectedModel(savedModel);
  }, []);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    window.localStorage.setItem(SELECTED_MODEL_KEY, modelId);
  };

  useEffect(() => {
    document.body.classList.toggle("sidebar-expanded", isSidebarExpanded);
    window.localStorage.setItem(
      "lumen.dashboard.sidebar",
      isSidebarExpanded ? "expanded" : "collapsed",
    );
    return () => {
      document.body.classList.remove("sidebar-expanded");
    };
  }, [isSidebarExpanded]);

  const firstName = getFirstName(user.displayName || user.email);
  const activeCount = projects.filter(
    (project) => project.status === "ready",
  ).length;
  const draftCount = projects.filter(
    (project) => project.status === "draft",
  ).length;
  const archivedCount = projects.filter(
    (project) => project.status === "failed",
  ).length;

  async function handleCreateProject(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt || creating) return;

    setCreating(true);
    setCreateError(null);
    try {
      const workspace = await createProject({ data: { prompt: nextPrompt } });
      await navigate({
        to: "/projects/$projectId",
        params: { projectId: workspace.project.id },
      });
    } catch (cause) {
      setCreateError(
        cause instanceof Error
          ? cause.message
          : "Unable to create your project. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleSuggestionClick(suggestion: string) {
    setPrompt(suggestion);
  }

  async function handleDeleteProject(projectId: string) {
    await removeProject({ data: { projectId } });
    await router.invalidate();
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <DashboardTopNav />
      <DashboardSidebar
        expanded={isSidebarExpanded}
        userLabel={firstName}
        userEmail={user.email}
        onToggle={() => setIsSidebarExpanded((current) => !current)}
      />

      <main className="dashboard-layout-offset mx-auto max-w-[1280px] px-6 py-10 lg:px-8">
        <header className="mx-auto mb-12 max-w-[760px] pt-4 text-center">
          <p className="mb-3 font-mono text-ui-sm tracking-wide text-muted">
            {formatDashboardDate()}
          </p>
          <h1 className="mb-8 text-[44px] font-semibold leading-[1.05] tracking-tight md:text-[52px]">
            Hi {firstName}, what do you want to{" "}
            <span className="italic text-ink">build</span> today?
          </h1>

          <form
            className="dashboard-prompt-card text-left"
            onSubmit={(event) => void handleCreateProject(event)}
          >
            <div className="px-3 pt-2.5">
              <textarea
                rows={3}
                className="max-h-56 min-h-[96px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink outline-none placeholder:text-subtle"
                value={prompt}
                disabled={creating}
                placeholder="Describe the website you want to build — SaaS analytics landing page, handmade store, photographer portfolio..."
                onChange={(event) => setPrompt(event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 px-2.5 pb-1.5 pt-1">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="unstyled"
                  className="dashboard-prompt-tool"
                  title="Attach images or references"
                  disabled
                >
                  <Paperclip aria-hidden="true" size={14} />
                  <span className="hidden sm:inline">Attach</span>
                </Button>
                <ModelPicker
                  selectedModel={selectedModel}
                  disabled={creating}
                  onModelChange={handleModelChange}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-1 font-mono text-[11px] text-subtle sm:inline-flex">
                  <kbd className="rounded border border-hairline bg-ink/[0.04] px-1.5 py-0.5">
                    ⌘
                  </kbd>
                  <kbd className="rounded border border-hairline bg-ink/[0.04] px-1.5 py-0.5">
                    ↵
                  </kbd>
                </span>
                <Button
                  type="submit"
                  disabled={!prompt.trim() || creating}
                  aria-busy={creating}
                  className="h-9 rounded-lg px-4"
                >
                  {creating ? (
                    <Loader2
                      aria-hidden="true"
                      className="animate-spin"
                      size={14}
                    />
                  ) : null}
                  Create project
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
            </div>
          </form>

          {createError ? (
            <p
              className="mt-3 rounded-input border border-danger-bg bg-danger-bg p-3 text-ui-sm text-danger-fg"
              role="alert"
            >
              {createError}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs">
            <span className="mr-1 text-subtle">Suggestions:</span>
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="unstyled"
                className="dashboard-suggestion-chip"
                onClick={() => void handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </header>

        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-hairline" />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-subtle">
            Your projects
          </span>
          <div className="h-px flex-1 bg-hairline" />
        </div>

        <section className="dashboard-library-card">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[24px] font-semibold leading-tight tracking-tight">
                Projects
              </h2>
              <p className="mt-1 text-ui-sm text-muted">
                Manage your created project here.
              </p>
            </div>
            {/* <Link
              to="/"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-ui-sm font-medium text-paper transition-colors duration-base hover:bg-ink/90"
            >
              <Plus aria-hidden="true" size={16} />
              Create Project
            </Link> */}
          </div>

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <nav className="inline-flex items-center gap-1 rounded-xl bg-ink/[0.04] p-1 text-ui-sm">
              <button
                className="h-8 rounded-lg bg-surface px-3 font-medium text-ink shadow-sm"
                type="button"
              >
                All{" "}
                <span className="ml-1 font-mono text-subtle">
                  {projects.length}
                </span>
              </button>
              <button
                className="h-8 rounded-lg px-3 text-muted hover:text-ink"
                type="button"
              >
                Active
              </button>
              <button
                className="h-8 rounded-lg px-3 text-muted hover:text-ink"
                type="button"
              >
                Draft
              </button>
              <button
                className="h-8 rounded-lg px-3 text-muted hover:text-ink"
                type="button"
              >
                Archived
              </button>
            </nav>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-ui-sm text-ink hover:bg-ink/[0.02]"
              type="button"
            >
              Last modified
              <ChevronDown
                aria-hidden="true"
                className="text-muted"
                size={14}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
                initials={getInitials(user.displayName || user.email)}
                onDelete={handleDeleteProject}
              />
            ))}
            {/* <Link
              to="/"
              className="group flex min-h-[252px] flex-col items-center justify-center rounded-[18px] border border-dashed border-hairline bg-paper/40 p-3 text-center transition-colors duration-base hover:border-ink/40 hover:bg-paper"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-chalk transition-colors duration-base group-hover:bg-ink group-hover:text-paper">
                <Plus aria-hidden="true" size={20} />
              </div>
              <div className="text-[15px] font-semibold tracking-tight">
                Create new project
              </div>
              <p className="mt-1 max-w-[190px] text-xs leading-relaxed text-muted">
                Describe an idea and let Cloud AI build the first draft.
              </p>
            </Link> */}
          </div>
        </section>

        <section className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-hairline bg-surface p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chalk">
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-ink"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <div className="text-ui-sm font-semibold tracking-tight">
                Pro plan · AI credits
              </div>
              <div className="mt-0.5 text-xs text-muted">
                <span className="font-mono">650</span> /{" "}
                <span className="font-mono">1,000</span> credits used this
                month. Resets on <span className="font-mono">06/28</span>.
              </div>
              <div className="mt-1 text-xs text-subtle">
                {activeCount} active · {draftCount} draft · {archivedCount}{" "}
                archived
              </div>
            </div>
          </div>
          <div className="min-w-[200px] max-w-md flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-ink/[0.06]">
              <div className="h-full w-[65%] rounded-full bg-ink" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#"
              className="text-ui-sm font-medium text-ink underline-offset-4 hover:underline"
            >
              Manage billing
            </a>
            <a
              href="#"
              className="h-8 rounded-md border border-hairline bg-surface px-3 text-ui-sm font-medium leading-8 hover:bg-ink/[0.02]"
            >
              Upgrade
            </a>
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-8 flex max-w-[1440px] flex-wrap items-center justify-between gap-3 border-t border-hairline px-6 py-8 text-xs text-subtle lg:px-8">
        <div className="flex items-center gap-3">
          <span>© 2026 Cloud AI Labs</span>
          <span>·</span>
          <a href="#" className="hover:text-ink">
            Changelog
          </a>
          <a href="#" className="hover:text-ink">
            Status
          </a>
          <a href="#" className="hover:text-ink">
            Docs
          </a>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> All
            systems normal
          </span>
        </div>
      </footer>
    </div>
  );
}

function DashboardTopNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-hairline bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-7">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-paper">
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </span>
            <span className="font-semibold tracking-tight">Cloud AI</span>
          </Link>
          <div className="hidden items-center gap-1 text-ui-sm lg:flex">
            <Link
              to="/dashboard"
              className="rounded-md bg-ink/[0.04] px-3 py-1.5 font-medium text-ink"
            >
              Projects
            </Link>
            <a
              href="#"
              className="rounded-md px-3 py-1.5 text-muted hover:bg-ink/[0.04] hover:text-ink"
            >
              Docs
            </a>
          </div>
        </div>
        <div className="hidden h-9 w-72 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 md:flex">
          <Search aria-hidden="true" className="text-subtle" size={16} />
          <input
            className="flex-1 bg-transparent text-ui-sm outline-none placeholder:text-subtle"
            placeholder="Search projects, templates..."
          />
          <kbd className="rounded bg-ink/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-subtle">
            ⌘K
          </kbd>
        </div>
      </div>
    </nav>
  );
}

function DashboardSidebar({
  expanded,
  userLabel,
  userEmail,
  onToggle,
}: {
  expanded: boolean;
  userLabel: string;
  userEmail: string;
  onToggle: () => void;
}) {
  const initials = getInitials(userLabel || userEmail);

  return (
    <aside
      className="dashboard-side-shell hidden xl:flex"
      data-expanded={expanded ? "true" : "false"}
      aria-label="Main menu"
    >
      <div>
        <div className="mb-5 flex min-w-0 items-center justify-between">
          <div className="dashboard-side-brand flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-paper shadow-sm">
              <svg
                aria-hidden="true"
                className="h-[19px] w-[19px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.9}
              >
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </span>
            <div className="dashboard-side-copy min-w-0">
              <div className="text-ui-sm font-semibold tracking-tight text-ink">
                Cloud AI
              </div>
              <div className="text-[11px] text-muted">Workspace</div>
            </div>
          </div>
          <button
            type="button"
            className="dashboard-side-toggle"
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5 transition-transform duration-base"
              data-chevron
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
        {/* gap-3 
gap-3  */}
        <nav className="flex flex-col gap-2">
          <Link
            to="/dashboard"
            className={classnames("dashboard-side-link", {
              "gap-3": expanded,
            })}
            title="Projects"
            aria-label="projects"
          >
            <Grid2X2 aria-hidden="true" size={24} />
            <span className="dashboard-side-label">Projects</span>
          </Link>
          <a
            href="#"
            className={classnames("dashboard-side-link", {
              "gap-3": expanded,
            })}
            title="Templates"
            aria-label="Templates"
          >
            <FileText aria-hidden="true" size={24} />
            <span className="dashboard-side-label">Templates</span>
          </a>
          <a
            href="#"
            className={classnames("dashboard-side-link", {
              "gap-3": expanded,
            })}
            title="Analytics"
            aria-label="Analytics"
          >
            <BarChart3 aria-hidden="true" size={24} />
            <span className="dashboard-side-label">Analytics</span>
          </a>
        </nav>
      </div>

      <div className="flex flex-col gap-2">
        <div className="dashboard-side-divider" />
        <button
          type="button"
          className={classnames("dashboard-side-link", {
            "gap-3": expanded,
          })}
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell aria-hidden="true" size={24} />
          <span className="dashboard-side-label">Notifications</span>
        </button>
        <Link
          to="/settings"
          className={classnames("dashboard-side-link", {
            "gap-3": expanded,
          })}
          title="Settings"
          aria-label="Settings"
        >
          <Settings aria-hidden="true" size={24} />
          <span className="dashboard-side-label">Settings</span>
        </Link>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={classnames("dashboard-side-profile", {
                "gap-3": expanded,
              })}
              title={userLabel}
              aria-label={`${userLabel} — account menu`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper shadow-sm ring-4 ring-paper">
                {initials}
              </span>
              <span
                className={classnames("dashboard-side-label min-w-0 text-left", {
                  hidden: !expanded,
                })}
              >
                <span className="block truncate text-ui-sm font-medium text-ink">
                  {userLabel}
                </span>
                <span className="block truncate text-[11px] text-muted">
                  {userEmail}
                </span>
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="end" sideOffset={12} className="w-64 p-3">
            <div className="flex min-w-0 items-center gap-3 border-b border-hairline pb-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="m-0 truncate text-ui-sm font-semibold text-ink">
                  {userLabel}
                </p>
                <p className="m-0 truncate text-[11px] text-muted">
                  {userEmail}
                </p>
              </div>
            </div>
            <SidebarThemeSwitcher />
            <div className="mt-3 border-t border-hairline pt-3">
              <SidebarSignOutButton />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );
}

const SIDEBAR_THEME_OPTIONS: Array<{
  value: AppTheme;
  label: string;
  icon: typeof Moon;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function SidebarThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="pt-3">
      <p className="m-0 mb-2 text-eyebrow font-mono uppercase tracking-wide text-subtle">
        Theme
      </p>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-hairline bg-chalk p-0.5">
        {SIDEBAR_THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={active}
              className={classnames(
                "flex flex-col items-center gap-1 rounded-md py-2 text-[11px] font-medium transition-colors duration-base focus-ring",
                active
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              <Icon aria-hidden="true" size={16} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SidebarSignOutButton() {
  const navigate = useNavigate();
  const logoutFn = useServerFn(logout);
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    try {
      const result = await logoutFn();
      await navigate({ to: result.redirectTo as never });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={loading}
      className="flex w-full items-center gap-2.5 rounded-md border border-danger-bg bg-danger-bg px-3 py-2 text-ui-sm font-medium text-danger-fg transition-colors duration-base hover:bg-danger-fg hover:text-paper disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
    >
      <LogOut aria-hidden="true" size={16} />
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}

function ProjectCard({
  project,
  index,
  initials,
  onDelete,
}: {
  project: Project;
  index: number;
  initials: string;
  onDelete: (projectId: string) => Promise<void>;
}) {
  const [deleteExpanded, setDeleteExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const status = getStatus(project.status);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await onDelete(project.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="group relative rounded-[18px] border border-hairline bg-paper/60 p-3 transition duration-base hover:-translate-y-0.5 hover:bg-paper hover:shadow-card-hover">
      <Link
        to="/projects/$projectId"
        params={{ projectId: project.id }}
        className="block"
      >
        <ProjectThumbnail index={index} project={project} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">
              {project.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs text-muted">
              {project.description ||
                "Describe an idea and let Cloud AI build the first draft."}
            </p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-subtle opacity-0 transition duration-base group-hover:opacity-100">
            <MoreHorizontal aria-hidden="true" size={16} />
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex -space-x-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-paper ring-2 ring-surface">
              {initials}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span className={status.className}>
              <span className={status.dotClassName} />
              {status.label}
            </span>
            <span className="font-mono">
              {formatRelative(project.updatedAt)}
            </span>
          </div>
        </div>
      </Link>

      <div className="absolute right-3 top-3 z-10">
        {deleteExpanded ? (
          <div className="flex items-center gap-1 rounded-pill border border-danger-bg bg-surface p-1 text-danger-fg shadow-card">
            <Button
              variant="unstyled"
              type="button"
              onClick={() => void confirmDelete()}
              disabled={deleting}
              aria-busy={deleting}
              className="inline-flex h-7 items-center gap-1 rounded-pill px-2 text-eyebrow font-semibold text-danger-fg transition-colors duration-base hover:bg-danger-bg focus-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin"
                  size={13}
                />
              ) : (
                <Trash2 aria-hidden="true" size={13} />
              )}
              Delete
            </Button>
            <Button
              variant="unstyled"
              type="button"
              onClick={() => setDeleteExpanded(false)}
              disabled={deleting}
              aria-label="Cancel delete"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors duration-base hover:bg-ink/[0.04] hover:text-ink focus-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X aria-hidden="true" size={13} />
            </Button>
          </div>
        ) : (
          <Button
            variant="unstyled"
            type="button"
            onClick={() => setDeleteExpanded(true)}
            aria-label="Delete project"
            title="Delete project"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-danger-bg bg-surface text-danger-fg shadow-card transition-colors duration-base hover:bg-danger-bg focus-ring"
          >
            <Trash2 aria-hidden="true" size={14} />
          </Button>
        )}
      </div>
    </article>
  );
}

function ProjectThumbnail({
  index,
  project,
}: {
  index: number;
  project: Project;
}) {
  const variant = index % 5;

  if (variant === 2) {
    return (
      <div className="relative mb-3 aspect-[16/10] overflow-hidden rounded-[14px] border border-hairline bg-ink">
        <div className="absolute inset-4 grid grid-cols-3 gap-1.5">
          <div className="row-span-2 rounded-lg bg-stone-700" />
          <div className="rounded-lg bg-stone-500" />
          <div className="rounded-lg bg-stone-600" />
          <div className="rounded-lg bg-stone-400" />
          <div className="rounded-lg bg-stone-500" />
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="font-mono text-[8px] uppercase tracking-widest text-paper/50">
            Project · 2026
          </div>
          <div className="mt-1 truncate font-semibold text-paper">
            {project.name}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 1) {
    return (
      <div className="relative mb-3 aspect-[16/10] overflow-hidden rounded-[14px] border border-hairline bg-[#F7F3EC]">
        <div className="absolute inset-3 grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-hairline bg-surface p-2"
            >
              <div className="aspect-square rounded-lg bg-stone-200" />
              <div className="mt-2 h-2 w-3/4 rounded bg-ink/70" />
              <div className="mt-1 h-1.5 w-1/2 rounded bg-ink/25" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="thumb-pattern relative mb-3 aspect-[16/10] overflow-hidden rounded-[14px] border border-hairline bg-[#F5F1EA]">
      <div className="absolute inset-3 overflow-hidden rounded-xl border border-hairline bg-surface">
        <div className="flex h-7 items-center gap-1.5 border-b border-hairline bg-white/70 px-3">
          <span className="h-2 w-2 rounded-full bg-stone-300" />
          <span className="h-2 w-2 rounded-full bg-stone-300" />
          <span className="h-2 w-2 rounded-full bg-stone-300" />
          <span className="ml-2 h-2 w-28 rounded bg-stone-200" />
        </div>
        <div className="p-4">
          <div className="h-3 w-16 rounded bg-ink" />
          <div className="mt-3 h-5 w-4/5 rounded bg-ink/85" />
          <div className="mt-1.5 h-5 w-3/5 rounded bg-ink/85" />
          <div className="mt-3 h-2 w-2/3 rounded bg-ink/25" />
          <div className="mt-4 flex gap-2">
            <div className="h-7 w-24 rounded-lg bg-ink" />
            <div className="h-7 w-20 rounded-lg border border-hairline" />
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatus(status: Project["status"]) {
  if (status === "ready") {
    return {
      label: "Live",
      className:
        "inline-flex h-6 items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 text-emerald-700",
      dotClassName: "h-1.5 w-1.5 rounded-full bg-emerald-600",
    };
  }
  if (status === "failed") {
    return {
      label: "Archived",
      className:
        "inline-flex h-6 items-center gap-1 rounded-full border border-danger-bg bg-danger-bg px-2 text-danger-fg",
      dotClassName: "h-1.5 w-1.5 rounded-full bg-danger-dot",
    };
  }
  if (status === "generating") {
    return {
      label: "Building",
      className:
        "inline-flex h-6 items-center gap-1 rounded-full border border-hairline bg-stone-100 px-2 text-stone-700",
      dotClassName: "h-1.5 w-1.5 rounded-full bg-ink",
    };
  }
  return {
    label: "Draft",
    className:
      "inline-flex h-6 items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 text-amber-700",
    dotClassName: "h-1.5 w-1.5 rounded-full bg-amber-500",
  };
}

function formatDashboardDate() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function getFirstName(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "there";
  const firstToken = trimmed.split(/\s+/)[0];
  return firstToken.includes("@") ? firstToken.split("@")[0] : firstToken;
}

function getInitials(label: string) {
  return (
    label
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "TM"
  );
}
