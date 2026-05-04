import { EmptyState } from '../common/EmptyState'
import { ErrorState } from '../common/ErrorState'
import { LoadingState } from '../common/LoadingState'
import type { Project } from '../../features/storefront-builder/types'
import { ProjectListItem } from './ProjectListItem'

type ProjectListProps = {
  projects: Project[]
  selectedProjectId?: string
  loading?: boolean
  error?: string
  onSelectProject: (projectId: string) => void
  onCreateProject?: () => void
}

export function ProjectList({
  projects,
  selectedProjectId,
  loading = false,
  error,
  onSelectProject,
  onCreateProject
}: ProjectListProps) {
  if (loading) return <LoadingState label="Đang tải projects..." />

  if (error) return <ErrorState title="Không tải được projects" message={error} />

  if (projects.length === 0) {
    return (
      <EmptyState
        tone="cream"
        title="Chưa có storefront project"
        description="Quay lại Home để nhập prompt và tạo storefront đầu tiên."
        action={
          onCreateProject ? (
            <button className="rounded-pill bg-primary px-lg py-sm text-button text-on-primary" type="button" onClick={onCreateProject}>
              Về Home
            </button>
          ) : null
        }
      />
    )
  }

  return (
    <section className="flex flex-col gap-sm" aria-label="Danh sách projects">
      {projects.map((project) => (
        <ProjectListItem key={project.id} project={project} selected={project.id === selectedProjectId} onSelect={onSelectProject} />
      ))}
    </section>
  )
}
