import { createFileRoute, redirect } from "@tanstack/react-router";

import { getCurrentUser } from "@/server/functions/auth";
import { getProjectWorkspace } from "@/server/functions/projects";
import { DashboardPage } from "@/pages/dashboard";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw redirect({ to: "/" as never });
    return { user };
  },
  loader: () => getProjectWorkspace({ data: {} }),
  component: DashboardPage,
});
