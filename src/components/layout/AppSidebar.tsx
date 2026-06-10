import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  type LucideIcon,
  Clock3,
  Grid2X2,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Star,
} from "lucide-react";
import { UserMenu } from "@/components/auth/UserMenu";
import { Button } from "@/components/ui/button";
import type { AuthUserSummary } from "@/auth/types";
import type { Project } from "@/shared/project-types";

export type AppSidebarItem = "dashboard" | "projects" | "starred";
export type ProjectFilter = "all" | "recent" | "ready" | "draft" | "failed";

const SIDEBAR_COLLAPSED_KEY = "projects-sidebar-collapsed";


type AppSidebarProps = {
  user: AuthUserSummary;
  activeItem: AppSidebarItem;
  projects?: Project[];
  onOpenProject?: (projectId: string) => void;
};

export function AppSidebar({
  user,
  activeItem,
  projects = [],
  onOpenProject,
}: AppSidebarProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 7),
    [projects],
  );

  function goDashboard() {
    void navigate({ to: "/dashboard" as never });
  }

  function goProjects() {
    void navigate({ to: "/projects" as never });
  }

  function goStarredProjects() {
    void navigate({ to: "/projects/starred" as never });
  }

  return (
    <aside
      data-collapsed={collapsed}
      className="flex min-w-0 flex-col rounded-card border border-hairline bg-surface p-3 text-ink shadow-card transition-all duration-base ease-standard"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          className="!h-auto !min-h-0 !px-0 !py-0 flex min-w-0 items-center gap-2 !justify-start text-left text-ui-sm font-medium text-ink hover:bg-transparent hover:opacity-75"
          onClick={goDashboard}
          aria-label="Dashboard"
        >
          <span
            className="h-5 w-5 shrink-0 rounded-md bg-ink"
            aria-hidden="true"
          />
          {!collapsed ? (
            <span className="truncate text-card-title font-semibold">Cloud AI</span>
          ) : null}
        </Button>
        <Button
          variant="icon"
          size="icon"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" size={16} />
          ) : (
            <PanelLeftClose aria-hidden="true" size={16} />
          )}
        </Button>
      </div>

      <SidebarSection title="Menu" collapsed={collapsed}>
        <SidebarButton
          icon={Home}
          label="Home"
          selected={activeItem === "dashboard"}
          collapsed={collapsed}
          onClick={goDashboard}
        />
      </SidebarSection>

      <SidebarSection title="Project" collapsed={collapsed}>
        <SidebarButton
          icon={Grid2X2}
          label="All Project"
          selected={activeItem === "projects"}
          collapsed={collapsed}
          onClick={goProjects}
        />
        <SidebarButton
          icon={Star}
          label="Starred"
          selected={activeItem === "starred"}
          collapsed={collapsed}
          onClick={goStarredProjects}
        />
      </SidebarSection>
      {recentProjects.length > 0 ? (
        <SidebarSection
          title="Recents"
          collapsed={collapsed}
          className="min-h-0 flex-1 overflow-hidden"
        >
          <div className="flex min-h-0 flex-col gap-1 overflow-y-auto pr-1">
            {recentProjects.map((project) => (
              <SidebarButton
                key={project.id}
                icon={Clock3}
                label={project.name}
                collapsed={collapsed}
                onClick={() =>
                  onOpenProject
                    ? onOpenProject(project.id)
                    : void navigate({
                        to: "/projects/$projectId",
                        params: { projectId: project.id },
                      })
                }
              />
            ))}
          </div>
        </SidebarSection>
      ) : (
        <div className="min-h-0 flex-1" />
      )}

      <div
        className={`mt-auto flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-3 border-t border-hairline pt-3`}
      >
        <UserMenu user={user} compact placement="top" align="left" />
      </div>
    </aside>
  );
}

function SidebarSection({
  title,
  collapsed,
  className = "",
  children,
}: {
  title: string;
  collapsed: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`mb-4 ${className}`} aria-label={title}>
      {!collapsed ? (
        <p className="eyebrow mb-2 mt-0 px-2 text-muted">
          {title}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function SidebarButton({
  icon: Icon,
  label,
  count,
  selected = false,
  collapsed,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  selected?: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const layoutClass = collapsed ? "justify-center px-0" : "";
  return (
    <Button
      variant={selected ? "nav-active" : "nav"}
      size="navItem"
      className={layoutClass}
      title={collapsed ? label : undefined}
      aria-label={label}
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="shrink-0" size={16} />
      {!collapsed ? (
        <span className="min-w-0 flex-1 truncate">{label}</span>
      ) : null}
      {!collapsed && typeof count === "number" ? (
        <span className="font-mono text-caption text-muted">
          {count}
        </span>
      ) : null}
    </Button>
  );
}

export function filterProjects(
  projects: Project[],
  filter: ProjectFilter,
  query: string,
): Project[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  return projects.filter((project) => {
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "recent"
          ? now - new Date(project.updatedAt).getTime() <= sevenDays
          : project.status === (filter as any);

    if (!matchesFilter) return false;
    if (!normalizedQuery) return true;

    const searchable =
      `${project.name} ${project.description ?? ""} ${project.initialPrompt}`.toLocaleLowerCase(
        "en-US",
      );
    return searchable.includes(normalizedQuery);
  });
}
