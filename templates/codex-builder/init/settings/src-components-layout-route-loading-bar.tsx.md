---
target: src/components/layout/route-loading-bar.tsx
---
import { useRouterState } from "@tanstack/react-router";

export function RouteLoadingBar() {
  const status = useRouterState({ select: (state) => state.status });
  const visible = status === "pending";

  return (
    <div
      role="progressbar"
      aria-hidden={!visible}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-transparent"
    >
      <div
        className={`h-full w-full bg-primary transition-all duration-300 ease-out ${
          visible ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
        }`}
      />
    </div>
  );
}
