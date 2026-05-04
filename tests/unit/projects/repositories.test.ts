import { describe, expect, it } from 'vitest'
import { InMemoryProjectRepository } from '../../../src/projects/repositories'
import { validProject } from '../../fixtures/storefront-project'

describe('project repositories', () => {
  it('saves and loads projects and revisions', async () => { const repo = new InMemoryProjectRepository(); await repo.saveProject(validProject); await repo.saveRevision({ id: 'rev', projectId: validProject.id, project: validProject, createdAt: 'now' }); expect(await repo.getProject(validProject.id)).toEqual(validProject); expect((await repo.getRevision('rev'))?.project.id).toBe(validProject.id) })
})
