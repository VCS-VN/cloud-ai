import { createEmptyProjectState, type ProjectState } from "./project-state.schema";
import type { PgProjectStateRepository, ProjectStateRecord } from "@/server/repositories/project-state-repository";

export class ProjectStateStore {
  constructor(private readonly repository: PgProjectStateRepository) {}

  async loadOrCreate(projectId: string, userId?: string): Promise<ProjectState> {
    const existing = await this.repository.getByProjectId(projectId, userId);
    if (existing) return stripRecord(existing);

    const now = new Date().toISOString();
    const state = createEmptyProjectState(projectId);
    const saved = await this.repository.save({
      ...state,
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    });
    return stripRecord(saved);
  }

  async save(projectState: ProjectState, userId?: string): Promise<ProjectState> {
    const now = new Date().toISOString();
    const existing = await this.repository.getByProjectId(projectState.projectId, userId);
    const saved = await this.repository.save({
      ...projectState,
      id: existing?.id ?? crypto.randomUUID(),
      userId: userId ?? existing?.userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    return stripRecord(saved);
  }

  async patch(projectId: string, patch: Partial<ProjectState>, userId?: string): Promise<ProjectState> {
    const current = await this.loadOrCreate(projectId, userId);
    return this.save(mergeProjectStatePatch(current, patch, projectId), userId);
  }
}

function stripRecord(record: ProjectStateRecord): ProjectState {
  const { id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...state } = record;
  return state;
}


function mergeProjectStatePatch(current: ProjectState, patch: Partial<ProjectState>, projectId: string): ProjectState {
  return {
    ...current,
    ...patch,
    projectId,
    stack: patch.stack ? { ...current.stack, ...patch.stack } : current.stack,
    packagePolicy: patch.packagePolicy ? { ...current.packagePolicy, ...patch.packagePolicy } : current.packagePolicy,
    ecommerceSpec: patch.ecommerceSpec ? { ...current.ecommerceSpec, ...patch.ecommerceSpec } : current.ecommerceSpec,
    brand: patch.brand
      ? {
          ...current.brand,
          ...patch.brand,
          colors: patch.brand.colors ? { ...current.brand.colors, ...patch.brand.colors } : current.brand.colors,
          typography: patch.brand.typography ? { ...current.brand.typography, ...patch.brand.typography } : current.brand.typography,
        }
      : current.brand,
    features: patch.features ? { ...current.features, ...patch.features } : current.features,
    constraints: patch.constraints ? { ...current.constraints, ...patch.constraints } : current.constraints,
    pages: patch.pages ?? current.pages,
    fileManifest: patch.fileManifest ?? current.fileManifest,
    decisionLog: patch.decisionLog ?? current.decisionLog,
    recentChanges: patch.recentChanges ?? current.recentChanges,
  };
}
