import { useEffect, useState, type FormEvent } from "react";
import {
  getRouteApi,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Loader2, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModelPicker } from "@/components/projects/ModelPicker";
import {
  createProjectFromPrompt,
  deleteProject,
} from "@/server/functions/projects";
import { DashboardTopNav } from "./components/DashboardTopNav";
import { DashboardSidebar } from "./components/DashboardSidebar";
import { ProjectCard } from "./components/ProjectCard";
import {
  formatDashboardDate,
  getFirstName,
  getInitials,
} from "./utils";

const route = getRouteApi("/dashboard/");

const SUGGESTIONS = [
  "B2B SaaS landing page",
  "Handmade online store",
  "Photography portfolio",
  "Event page",
] as const;

const SELECTED_MODEL_KEY = "project-detail-selected-model";

export function DashboardPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const createProject = useServerFn(createProjectFromPrompt);
  const removeProject = useServerFn(deleteProject);

  const { projects } = route.useLoaderData();
  const { user } = route.useRouteContext();
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
