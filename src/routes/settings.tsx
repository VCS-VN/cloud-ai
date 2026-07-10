import { createFileRoute, redirect } from "@tanstack/react-router";

import { getCurrentUser } from "@/server/functions/auth";
import { SettingsPage } from "@/pages/settings";

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw redirect({ to: "/" });
    return { user };
  },
  component: SettingsPage,
});
