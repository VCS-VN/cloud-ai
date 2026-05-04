import type { AIProvider, GenerationCandidate, GenerationRequest } from './ai-provider'
import { loadAIEnv, type AIEnv } from './env'

export class RealAIProvider implements AIProvider {
  private readonly config: AIEnv
  constructor(env: NodeJS.ProcessEnv = process.env) { this.config = loadAIEnv(env) }
  async generateStorefront(_request: GenerationRequest): Promise<GenerationCandidate> {
    throw new Error(`Real provider '${this.config.provider}' is configured but network adapter is not implemented in this MVP scaffold`)
  }
}
