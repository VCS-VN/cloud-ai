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
  searchQuery?: string
  variant?: 'grid' | 'list'
  onSelectProject: (projectId: string) => void
  onCreateProject?: () => void
  onClearSearch?: () => void
}

export function ProjectList({
  projects,
  selectedProjectId,
  loading = false,
  error,
  searchQuery = '',
  variant = 'grid',
  onSelectProject,
  onCreateProject,
  onClearSearch
}: ProjectListProps) {
  if (loading) return <LoadingState label="Đang tải projects..." />

  if (error) return <ErrorState title="Không tải được projects" message={error} />

  if (projects.length === 0) {
    const hasSearch = searchQuery.trim().length > 0

    return (
      <EmptyState
        tone={hasSearch ? 'plain' : 'cream'}
        title={hasSearch ? 'Không tìm thấy project' : 'Chưa có website project'}
        description={
          hasSearch
            ? 'Thử từ khóa khác hoặc xóa tìm kiếm để xem lại toàn bộ dự án.'
            : 'Bắt đầu bằng một mô tả ngắn về website bạn muốn tạo.'
        }
        action={
          hasSearch && onClearSearch ? (
            <button className="builder-button bg-canvas text-ink ring-1 ring-hairline" type="button" onClick={onClearSearch}>
              Xóa tìm kiếm
            </button>
          ) : onCreateProject ? (
            <button className="builder-button" type="button" onClick={onCreateProject}>
              Tạo project đầu tiên
            </button>
          ) : null
        }
      />
    )
  }

  return (
    <section className={variant === 'grid' ? 'grid gap-md md:grid-cols-2 2xl:grid-cols-3' : 'flex flex-col gap-sm'} aria-label="Danh sách projects">
      {projects.map((project) => (
        <ProjectListItem key={project.id} project={project} selected={project.id === selectedProjectId} variant={variant} onSelect={onSelectProject} />
      ))}
    </section>
  )
}
