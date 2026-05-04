export interface OutputProvider { createOutput(projectId: string, revisionId: string): Promise<{ method: string; url: string; token?: string }> }
