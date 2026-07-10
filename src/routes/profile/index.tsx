import { createFileRoute, redirect } from "@tanstack/react-router";

import { getCurrentUser } from "@/server/functions/auth";
import { ProfileSettingsPage } from "@/pages/profile";

export const Route = createFileRoute("/profile/")({
  beforeLoad: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw redirect({ to: "/" });
    return { user };
  },
  component: ProfileSettingsPage,
});
