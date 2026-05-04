import { redactSecrets } from '../security/redaction'
import type { ProjectRepository } from './repositories'
export class OperatorService {
  constructor(private readonly repository: ProjectRepository) {}
  async getProjectState(projectId: string) {
    const project = await this.repository.getProject(projectId)
    const generationHistory = await this.repository.listGenerationRecords(projectId)
    return redactSecrets({ project, generationHistory })
  }
}
