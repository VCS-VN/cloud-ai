import { describe, expect, it } from 'vitest'
import { generatePwaManifest, generateServiceWorker } from '../../../src/export/pwa-exporter'
import { createSeedProject } from '../../../src/features/storefront-builder/mock-store'
import { StorefrontBuilderFileTreeService } from '../../../src/features/storefront-builder/file-tree-service'
import { StorefrontBuilderMessageService } from '../../../src/features/storefront-builder/message-service'
import { StorefrontBuilderProjectService } from '../../../src/features/storefront-builder/project-service'
import { InMemoryProjectRepository } from '../../../src/projects/repositories'
import type { StorefrontProject } from '../../../src/storefront/types'

async function createServices() {
  const repository = new InMemoryProjectRepository()
  return {
    repository,
    projectService: new StorefrontBuilderProjectService(repository, repository, repository),
    messageService: new StorefrontBuilderMessageService(repository, repository),
    fileTreeService: new StorefrontBuilderFileTreeService(repository, repository)
  }
}

describe('storefront builder services', () => {
  it('creates a project with initial user and agent messages', async () => {
    const { projectService } = await createServices()
    const workspace = await projectService.createProjectFromPrompt('Tạo storefront mỹ phẩm phong cách tối giản')

    expect(workspace.project.initialPrompt).toContain('mỹ phẩm')
    expect(workspace.messages.map((message) => message.role)).toEqual(['user', 'agent'])
    expect(workspace.fileTree.length).toBeGreaterThan(0)
  })

  it('rejects empty project prompts and messages', async () => {
    const { projectService, messageService } = await createServices()
    await expect(projectService.createProjectFromPrompt('   ')).rejects.toThrow('Prompt không được để trống')

    const workspace = await projectService.createProjectFromPrompt('Tạo storefront trà thủ công')
    await expect(messageService.sendProjectMessage(workspace.project.id, '   ')).rejects.toThrow('Message không được để trống')
  })

  it('loads file tree and selected file nodes', async () => {
    const { projectService, fileTreeService } = await createServices()
    const workspace = await projectService.createProjectFromPrompt('Tạo storefront túi da')
    const tree = await fileTreeService.getProjectFileTree(workspace.project.id)
    const firstFile = tree[0].children?.find((node) => node.type === 'file')

    expect(tree[0].type).toBe('folder')
    expect(firstFile).toBeDefined()
    await expect(fileTreeService.getProjectFileNode(workspace.project.id, firstFile!.id)).resolves.toMatchObject({ id: firstFile!.id })
  })

  it('generates PWA files only when enabled and avoids API caching', () => {
    const project: StorefrontProject = {
      id: 'storefront-demo',
      name: 'Demo',
      siteTitle: 'Demo',
      tagline: 'Demo storefront',
      businessProfile: {
        businessName: 'Demo',
        industry: 'Retail',
        shortDescription: 'Demo',
        targetAudience: 'Customers',
        brandVoice: 'Clear',
        missingFields: []
      },
      brandProfile: { styleKeywords: [], preferredColors: [], assumptions: [] },
      products: [],
      pages: [
        {
          id: 'home',
          slug: '/',
          title: 'Home',
          seo: { title: 'Demo', metaDescription: 'Demo' },
          sections: [
            {
              id: 'hero',
              type: 'hero',
              title: 'Hero',
              content: {},
              layout: {},
              editableFields: [],
              regenerationScope: { kind: 'section', pageId: 'home', sectionId: 'hero' },
              source: 'ai'
            }
          ]
        }
      ],
      theme: { colors: { primary: '#000000', canvas: '#ffffff' }, typography: {}, spacing: {}, radius: {}, buttonStyle: {}, customTokens: {} },
      generationHistory: [],
      exportPublishState: { method: 'none', status: 'not-started' },
      pwa: createSeedProject({ name: 'Demo' }).pwa,
      createdAt: '2026-05-04T00:00:00.000Z',
      updatedAt: '2026-05-04T00:00:00.000Z'
    }

    expect(generatePwaManifest(project)?.content).toContain('short_name')
    expect(generateServiceWorker(project)?.content).toContain('/api')
    expect(generateServiceWorker(project)?.content).toContain('never cache private API')

    const disabled = { ...project, pwa: { ...project.pwa, enabled: false } }
    expect(generatePwaManifest(disabled)).toBeUndefined()
    expect(generateServiceWorker(disabled)).toBeUndefined()
  })
})
