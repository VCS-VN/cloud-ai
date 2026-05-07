import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { type LucideIcon, AlertCircle, Clock3, FolderKanban, Grid2X2, Home, PanelLeftClose, PanelLeftOpen, Star } from 'lucide-react'
import { UserMenu } from '@/components/auth/UserMenu'
import type { AuthUserSummary } from '@/auth/types'
import type { Project } from '@/shared/project-types'

export type AppSidebarItem = 'dashboard' | 'projects'
export type ProjectFilter = 'all' | 'recent' | 'ready' | 'draft' | 'failed'

const SIDEBAR_COLLAPSED_KEY = 'projects-sidebar-collapsed'

const projectFilters: Array<{
  key: ProjectFilter
  label: string
  icon: LucideIcon
}> = [
  { key: 'all', label: 'All projects', icon: Grid2X2 },
  { key: 'recent', label: 'Recently edited', icon: Clock3 },
  { key: 'ready', label: 'Ready', icon: Star },
  { key: 'draft', label: 'Drafts', icon: FolderKanban },
  { key: 'failed', label: 'Needs review', icon: AlertCircle },
]

type AppSidebarProps = {
  user: AuthUserSummary
  activeItem: AppSidebarItem
  projects?: Project[]
  projectFilter?: ProjectFilter
  onProjectFilterChange?: (filter: ProjectFilter) => void
  onOpenProject?: (projectId: string) => void
}

export function AppSidebar({ user, activeItem, projects = [], projectFilter = 'all', onProjectFilterChange, onOpenProject }: AppSidebarProps) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true')
  }, [])

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }

  const recentProjects = useMemo(
    () => [...projects].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 7),
    [projects],
  )

  function goDashboard() {
    void navigate({ to: '/dashboard' as never })
  }

  function goProjects() {
    void navigate({ to: '/projects' as never })
  }

  return (
    <aside data-collapsed={collapsed} className="flex min-w-0 flex-col rounded-lg border border-[var(--app-sidebar-border)] bg-[var(--app-sidebar-bg)] p-sm text-[var(--app-sidebar-text)] shadow-none transition-all duration-300 ease-out">
      <div className="mb-md flex items-center justify-between gap-sm">
        <button
          className="flex min-w-0 items-center gap-xs border-0 bg-transparent p-0 text-left text-[12px] font-[520] text-[var(--app-sidebar-text)]"
          type="button"
          onClick={goDashboard}
          aria-label="Dashboard"
        >
          <span className="h-5 w-5 shrink-0 rounded-sm bg-[var(--color-block-lilac)]" aria-hidden="true" />
          {!collapsed ? <span className="truncate text-[15px] font-[680]">Cloud AI</span> : null}
        </button>
        <button
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--app-sidebar-border)] bg-[var(--app-sidebar-control)] text-[var(--app-icon-muted)] transition-all duration-200 hover:bg-[var(--app-sidebar-control-hover)] hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" size={16} /> : <PanelLeftClose aria-hidden="true" size={16} />}
        </button>
      </div>

      <SidebarSection title="Menu" collapsed={collapsed}>
        <SidebarButton icon={Home} label="Home" selected={activeItem === 'dashboard'} collapsed={collapsed} onClick={goDashboard} />
        <SidebarButton icon={FolderKanban} label="Projects" selected={activeItem === 'projects'} collapsed={collapsed} onClick={goProjects} />
      </SidebarSection>

      {onProjectFilterChange ? (
        <SidebarSection title="Projects" collapsed={collapsed}>
          {projectFilters.map((filter) => (
            <SidebarButton
              key={filter.key}
              icon={filter.icon}
              label={filter.label}
              count={countProjects(projects, filter.key)}
              selected={projectFilter === filter.key}
              collapsed={collapsed}
              onClick={() => onProjectFilterChange(filter.key)}
            />
          ))}
        </SidebarSection>
      ) : null}

      {recentProjects.length > 0 ? (
        <SidebarSection title="Recents" collapsed={collapsed} className="min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 flex-col gap-xxs overflow-y-auto pr-xxs">
            {recentProjects.map((project) => (
              <SidebarButton
                key={project.id}
                icon={Clock3}
                label={project.name}
                collapsed={collapsed}
                onClick={() => (onOpenProject ? onOpenProject(project.id) : void navigate({ to: '/projects/$projectId', params: { projectId: project.id } }))}
              />
            ))}
          </div>
        </SidebarSection>
      ) : (
        <div className="min-h-0 flex-1" />
      )}

      <div className={`mt-auto flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-sm border-t border-[var(--app-sidebar-border)] pt-sm`}>
        <UserMenu user={user} compact placement="top" align="left" />
      </div>
    </aside>
  )
}

function SidebarSection({ title, collapsed, className = '', children }: { title: string; collapsed: boolean; className?: string; children: ReactNode }) {
  return (
    <section className={`mb-md ${className}`} aria-label={title}>
      {!collapsed ? <p className="mb-xs mt-0 px-xs text-[12px] font-[520] text-[var(--app-sidebar-subtle)]">{title}</p> : null}
      <div className="flex flex-col gap-xxs">{children}</div>
    </section>
  )
}

function SidebarButton({ icon: Icon, label, count, selected = false, collapsed, onClick }: { icon: LucideIcon; label: string; count?: number; selected?: boolean; collapsed: boolean; onClick: () => void }) {
  return (
    <button
      className={`flex h-9 w-full min-w-0 items-center gap-sm rounded-sm border-0 px-sm text-left text-[12px] transition ${selected ? 'bg-[var(--app-selected-bg)] text-[var(--app-selected-text)]' : 'bg-transparent text-[var(--app-sidebar-muted)] hover:bg-[var(--app-sidebar-control-hover)] hover:text-[var(--app-icon)]'} ${collapsed ? 'justify-center px-0' : ''}`}
      type="button"
      title={collapsed ? label : undefined}
      aria-label={label}
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="shrink-0" size={16} />
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
      {!collapsed && typeof count === 'number' ? <span className="font-mono text-[12px] text-[var(--app-sidebar-subtle)]">{count}</span> : null}
    </button>
  )
}

export function filterProjects(projects: Project[], filter: ProjectFilter, query: string): Project[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('en-US')
  const now = Date.now()
  const sevenDays = 7 * 24 * 60 * 60 * 1000

  return projects.filter((project) => {
    const matchesFilter = filter === 'all' ? true : filter === 'recent' ? now - new Date(project.updatedAt).getTime() <= sevenDays : project.status === (filter as any)

    if (!matchesFilter) return false
    if (!normalizedQuery) return true

    const searchable = `${project.name} ${project.description ?? ''} ${project.initialPrompt}`.toLocaleLowerCase('en-US')
    return searchable.includes(normalizedQuery)
  })
}

function countProjects(projects: Project[], filter: ProjectFilter): number {
  return filterProjects(projects, filter, '').length
}
