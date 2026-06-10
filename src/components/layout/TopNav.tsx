import { Link, useNavigate } from "@tanstack/react-router";
import type { AuthUserSummary } from "@/auth/types";
import { UserMenu } from "@/components/auth/UserMenu";
import { Button } from "@/components/ui/button";

type TopNavProps = {
  user: AuthUserSummary;
  active?: "new" | "projects" | "templates" | "docs";
  cancelHref?: string;
};

const NAV_ITEMS: Array<{ key: NonNullable<TopNavProps["active"]>; label: string; to: string }> = [
  { key: "projects", label: "Projects", to: "/dashboard" },
  { key: "new", label: "New", to: "/" },
  { key: "templates", label: "Templates", to: "/" },
  { key: "docs", label: "Docs", to: "/user-guide" },
];

export function TopNav({ user, active = "new", cancelHref }: TopNavProps) {
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-40 border-b border-hairline bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-container items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-7">
          <Link to={"/dashboard" as never} className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink">
              <svg
                className="h-3.5 w-3.5 text-paper"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </span>
            <span className="font-semibold tracking-tight text-ink">Cloud AI</span>
          </Link>
          <div className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => {
              const isActive = item.key === active;
              return (
                <Link
                  key={item.key}
                  to={item.to as never}
                  className={
                    isActive
                      ? "rounded-md bg-ink/[0.04] px-3 py-1.5 text-ui-sm font-medium text-ink"
                      : "rounded-md px-3 py-1.5 text-ui-sm text-muted transition-colors duration-base hover:bg-ink/[0.04] hover:text-ink"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {cancelHref ? (
            <Button
              variant="unstyled"
              onClick={() => void navigate({ to: cancelHref as never })}
              className="text-ui-sm text-muted transition-colors duration-base hover:text-ink"
            >
              Cancel
            </Button>
          ) : null}
          <UserMenu user={user} compact placement="bottom" align="right" />
        </div>
      </div>
    </nav>
  );
}
