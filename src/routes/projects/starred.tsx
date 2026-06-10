import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
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
    <WorkspaceShell
      sidebar={
        <AppSidebar
          user={user}
          activeItem="starred"
          projects={projects}
          onOpenProject={openProject}
        />
      }
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-h2 font-semibold leading-tight tracking-tight">
            Starred
          </h1>
          <p className="m-0 mt-1 text-ui-sm text-muted">
            Quickly return to projects you mark as important.
          </p>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-pill bg-chalk text-muted">
          <Star aria-hidden="true" size={16} />
        </span>
      </header>

      <EmptyState
        title="Starred projects are coming soon"
        description="This page is ready for your starred projects. Star and unstar actions will be added in a later update."
      />
    </WorkspaceShell>
  );
}
