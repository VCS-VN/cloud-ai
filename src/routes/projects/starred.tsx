import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { EmptyState } from "@/components/common/EmptyState";
import { getCurrentUser } from "@/server/functions/auth";
import { getProjectWorkspace } from "@/server/functions/projects";

export const Route = createFileRoute("/projects/starred")({
  beforeLoad: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw redirect({ to: "/" });
    return { user };
  },
  loader: () => getProjectWorkspace({ data: {} }),
  component: StarredProjectsPage,
});

function StarredProjectsPage() {
  const navigate = useNavigate();
  const { projects } = Route.useLoaderData();
  const { user } = Route.useRouteContext();

  function openProject(projectId: string) {
    void navigate({ to: "/projects/$projectId", params: { projectId } });
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--app-bg)] p-xs text-[var(--app-text)] sm:p-sm">
      <div className="grid min-h-[calc(100vh-16px)] gap-sm transition-[grid-template-columns] duration-200 lg:grid-cols-[290px_minmax(0,1fr)] has-[aside[data-collapsed=true]]:lg:grid-cols-[72px_minmax(0,1fr)]">
        <AppSidebar
          user={user}
          activeItem="starred"
          projects={projects}
          onOpenProject={openProject}
        />

        <section className="min-w-0 rounded-sm bg-[var(--app-surface)] p-sm transition-colors duration-300 sm:p-md">
          <header className="mb-md flex items-start justify-between gap-sm">
            <div>
              <h1 className="m-0 text-[20px] font-[580] leading-tight tracking-[-0.015em]">
                Starred
              </h1>
              <p className="m-0 mt-xxs text-[12px] leading-4 text-[var(--app-muted)]">
                Quickly return to projects you mark as important.
              </p>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-control)] text-[var(--app-icon-muted)]">
              <Star aria-hidden="true" size={16} />
            </span>
          </header>

          <EmptyState
            tone="cream"
            title="Starred projects are coming soon"
            description="This page is ready for your starred projects. Star and unstar actions will be added in a later update."
          />
        </section>
      </div>
    </main>
  );
}
