---
target: src/routes/__root.tsx
---
import { Outlet, createRootRoute } from "@tanstack/react-router";

import "@/styles/app.css";

export const Route = createRootRoute({
  component: () => <Outlet />,
});
