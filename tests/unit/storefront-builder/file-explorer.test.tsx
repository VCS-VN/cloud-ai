import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FilePreviewPanel } from '../../../src/components/projects/FilePreviewPanel'
import { ProjectFileExplorer } from '../../../src/components/projects/ProjectFileExplorer'
import { createSeedFileTree, createSeedProject } from '../../../src/features/storefront-builder/mock-store'

describe('file explorer components', () => {
  const project = createSeedProject()
  const tree = createSeedFileTree(project)
  const root = tree[0]
  const manifest = tree.find((node) => node.name === 'manifest.webmanifest')

  it('renders nested virtual folders and files with selected state', () => {
    const html = renderToStaticMarkup(
      <ProjectFileExplorer fileTree={[root]} selectedNodeId={root.id} onSelectNode={() => undefined} />
    )

    expect(html).toContain('Files')
    expect(html).toContain('storefront')
    expect(html).toContain('aria-pressed="true"')
  })

  it('renders explorer empty state', () => {
    const html = renderToStaticMarkup(<ProjectFileExplorer fileTree={[]} onSelectNode={() => undefined} />)
    expect(html).toContain('Chưa có files')
  })

  it('renders safe text preview and never raw HTML execution hooks', () => {
    const html = renderToStaticMarkup(<FilePreviewPanel node={manifest} />)

    expect(html).toContain('manifest.webmanifest')
    expect(html).toContain('short_name')
    expect(html).not.toContain('dangerouslySetInnerHTML')
  })
})
