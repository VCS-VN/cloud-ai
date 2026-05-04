import type { GenerationRecord, StorefrontProject } from '../storefront/types'

export type ProjectRevision = { id: string; projectId: string; project: StorefrontProject; createdAt: string }
export type PreviewTokenRecord = { token: string; projectId: string; revisionId: string; createdAt: string }

export interface ProjectRepository {
  saveProject(project: StorefrontProject): Promise<StorefrontProject>
  getProject(id: string): Promise<StorefrontProject | undefined>
  saveRevision(revision: ProjectRevision): Promise<ProjectRevision>
  getRevision(id: string): Promise<ProjectRevision | undefined>
  addGenerationRecord(record: GenerationRecord): Promise<GenerationRecord>
  listGenerationRecords(projectId: string): Promise<GenerationRecord[]>
}

export interface PreviewTokenRepository {
  savePreviewToken(record: PreviewTokenRecord): Promise<PreviewTokenRecord>
  getPreviewToken(token: string): Promise<PreviewTokenRecord | undefined>
}

export class InMemoryProjectRepository implements ProjectRepository, PreviewTokenRepository {
  projects = new Map<string, StorefrontProject>()
  revisions = new Map<string, ProjectRevision>()
  records: GenerationRecord[] = []
  tokens = new Map<string, PreviewTokenRecord>()
  async saveProject(project: StorefrontProject) { this.projects.set(project.id, project); return project }
  async getProject(id: string) { return this.projects.get(id) }
  async saveRevision(revision: ProjectRevision) { this.revisions.set(revision.id, revision); return revision }
  async getRevision(id: string) { return this.revisions.get(id) }
  async addGenerationRecord(record: GenerationRecord) { this.records.push(record); return record }
  async listGenerationRecords(projectId: string) { return this.records.filter((record) => record.projectId === projectId) }
  async savePreviewToken(record: PreviewTokenRecord) { this.tokens.set(record.token, record); return record }
  async getPreviewToken(token: string) { return this.tokens.get(token) }
}
