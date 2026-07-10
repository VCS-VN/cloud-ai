import { createFileRoute, redirect } from "@tanstack/react-router";

import { getCurrentUser } from "@/server/functions/auth";
import { getProjectWorkspace } from "@/server/functions/projects";
import { ProjectDetailPage } from "@/pages/project-detail";

export const Route = createFileRoute("/projects/$projectId")({
  beforeLoad: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw redirect({ to: "/" });
    return { user };
  },
  loader: ({ params }) =>
    getProjectWorkspace({ data: { projectId: params.projectId } }),
  component: ProjectDetailPage,
});
