import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomePromptForm } from '../../../src/components/home/HomePromptForm'
import { ProjectList } from '../../../src/components/projects/ProjectList'
import { createSeedProject } from '../../../src/features/storefront-builder/mock-store'

describe('home and project list components', () => {
  it('renders Home prompt greeting controls and CTA state', () => {
    const html = renderToStaticMarkup(
      <HomePromptForm prompt="Tạo storefront" onPromptChange={() => undefined} onSubmit={() => undefined} />
    )

    expect(html).toContain('Prompt storefront')
    expect(html).toContain('Tạo storefront')
    expect(html).toContain('Ví dụ:')
  })

  it('renders Home loading and error states', () => {
    const html = renderToStaticMarkup(
      <HomePromptForm prompt="Tạo storefront" loading error="Không thể tạo" onPromptChange={() => undefined} onSubmit={() => undefined} />
    )

    expect(html).toContain('Đang tạo')
    expect(html).toContain('Không thể tạo')
  })

  it('renders ProjectList empty and selected project states', () => {
    const emptyHtml = renderToStaticMarkup(<ProjectList projects={[]} onSelectProject={() => undefined} />)
    const project = createSeedProject()
    const listHtml = renderToStaticMarkup(
      <ProjectList projects={[project]} selectedProjectId={project.id} onSelectProject={() => undefined} />
    )

    expect(emptyHtml).toContain('Chưa có storefront project')
    expect(listHtml).toContain(project.name)
    expect(listHtml).toContain('aria-pressed="true"')
  })
})
