import { useMemo, useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Grid2X2, List, Plus, Search } from 'lucide-react'
import { AppSidebar, filterProjects, type ProjectFilter } from '@/components/layout/AppSidebar'
import { ProjectList } from '@/components/projects/ProjectList'
import { getCurrentUser } from '@/server/functions/auth'
import { deleteProject, getProjectWorkspace } from '@/server/functions/projects'
import { useServerFn } from '@tanstack/react-start'

type ViewMode = 'grid' | 'list'

export const Route = createFileRoute('/projects/')({
  beforeLoad: async () => {
    const { user } = await getCurrentUser()
    if (!user) throw redirect({ to: '/' })
    return { user }
  },
  loader: () => getProjectWorkspace({ data: {} }),
  component: ProjectsPage,
})

function ProjectsPage() {
  const navigate = useNavigate()
  const removeProject = useServerFn(deleteProject)
  const { projects } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const [activeProjects, setActiveProjects] = useState(projects)
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all')
  const [projectSearch, setProjectSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const filteredProjects = useMemo(() => filterProjects(activeProjects, projectFilter, projectSearch), [activeProjects, projectFilter, projectSearch])

  function openProject(projectId: string) {
    void navigate({ to: '/projects/$projectId', params: { projectId } })
  }

  function goDashboard() {
    void navigate({ to: '/dashboard' as never })
  }

  async function deleteProjectFromList(projectId: string) {
    await removeProject({ data: { projectId } })
    setActiveProjects((currentProjects) => currentProjects.filter((project) => project.id !== projectId))
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--app-bg)] p-xs text-[var(--app-text)] sm:p-sm">
      <div className="grid min-h-[calc(100vh-16px)] gap-sm transition-[grid-template-columns] duration-200 lg:grid-cols-[290px_minmax(0,1fr)] has-[aside[data-collapsed=true]]:lg:grid-cols-[72px_minmax(0,1fr)]">
        <AppSidebar
          user={user}
          activeItem="projects"
          projects={projects}
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
          onOpenProject={openProject}
        />

        <section className="min-w-0 rounded-sm bg-[var(--app-surface)] p-sm transition-colors duration-300 sm:p-md">
          <header className="mb-md flex flex-col gap-sm xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="m-0 text-[20px] font-[580] leading-tight tracking-[-0.015em]">Projects</h1>
              <p className="m-0 mt-xxs text-[12px] leading-4 text-[var(--app-muted)]">Manage your AI website projects.</p>
            </div>
            <button className="builder-button bg-[var(--color-primary)] text-[var(--color-on-primary)] [&_svg]:text-[var(--app-icon-selected)]" type="button" onClick={goDashboard}>
              <Plus aria-hidden="true" size={15} />
              Create
            </button>
          </header>

          <div className="mb-md flex flex-col gap-xs xl:flex-row xl:items-center">
            <label className="relative min-w-0 flex-1" htmlFor="project-search">
              <span className="sr-only">Search projects</span>
              <Search className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-[var(--app-icon-subtle)]" aria-hidden="true" size={16} />
              <input
                id="project-search"
                className="h-9 w-full rounded-sm border border-[var(--app-border)] bg-[var(--app-control)] py-xs pl-9 pr-sm text-[12px] text-[var(--app-page-text)] outline-none placeholder:text-[var(--app-subtle-text)] focus:border-[var(--app-border-strong)]"
                value={projectSearch}
                placeholder="Search projects..."
                onChange={(event) => setProjectSearch(event.target.value)}
              />
            </label>
            <div className="flex items-center gap-xs">
              <button className="inline-flex h-9 items-center gap-xs rounded-sm border border-[var(--app-border)] bg-[var(--app-control)] px-sm text-[12px] text-[var(--app-muted)]" type="button">
                Last edited
              </button>
              <button
                className={`inline-flex h-9 w-9 items-center justify-center rounded-sm border border-[var(--app-border)] ${viewMode === 'grid' ? 'bg-[var(--app-selected-bg)] text-[var(--app-selected-text)] [&_svg]:text-[var(--app-icon-selected)]' : 'bg-transparent text-[var(--app-muted)] [&_svg]:text-[var(--app-icon-muted)]'}`}
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
              >
                <Grid2X2 aria-hidden="true" size={16} />
              </button>
              <button
                className={`inline-flex h-9 w-9 items-center justify-center rounded-sm border border-[var(--app-border)] ${viewMode === 'list' ? 'bg-[var(--app-selected-bg)] text-[var(--app-selected-text)] [&_svg]:text-[var(--app-icon-selected)]' : 'bg-transparent text-[var(--app-muted)] [&_svg]:text-[var(--app-icon-muted)]'}`}
                type="button"
                onClick={() => setViewMode('list')}
                aria-label="List view"
              >
                <List aria-hidden="true" size={16} />
              </button>
            </div>
          </div>

          <p className="mb-sm mt-0 text-[12px] font-[520] text-[var(--app-muted)]">
            {projectFilter === 'recent' ? 'Recently edited' : 'Projects'} · {filteredProjects.length}
          </p>
          <ProjectList projects={filteredProjects} searchQuery={projectSearch} variant={viewMode} onSelectProject={openProject} onDeleteProject={deleteProjectFromList} onCreateProject={goDashboard} onClearSearch={() => setProjectSearch('')} />
        </section>
      </div>
    </main>
  )
}
