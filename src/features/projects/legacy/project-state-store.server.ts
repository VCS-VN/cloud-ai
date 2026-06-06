import { createEmptyProjectState, EMPTY_DEV_RUNTIME, type DevRuntime, type FileManifestEntry, type ProjectState } from "./project-state.schema";
import type { PgProjectStateRepository, ProjectStateRecord } from "@/server/repositories/project-state-repository";

export type CodeChangeRecordInput = {
  runId: string;
  userPrompt: string;
  summary: string;
  changedFiles: string[];
  validationStatus: "passed" | "failed" | "skipped";
};

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

  async appendCodeChangeRecord(projectId: string, record: CodeChangeRecordInput, userId?: string): Promise<ProjectState> {
    const current = await this.loadOrCreate(projectId, userId);
    return this.save({
      ...current,
      recentChanges: [
        ...current.recentChanges,
        {
          at: new Date().toISOString(),
          runId: record.runId,
          userPrompt: record.userPrompt,
          summary: record.summary,
          changedFiles: record.changedFiles,
          validationStatus: record.validationStatus,
        },
      ].slice(-10),
    }, userId);
  }

  async updateFileManifest(projectId: string, entries: FileManifestEntry[], userId?: string): Promise<ProjectState> {
    const current = await this.loadOrCreate(projectId, userId);
    const manifest = new Map(current.fileManifest.map((entry) => [entry.path, entry]));
    for (const entry of entries) manifest.set(entry.path, entry);
    return this.save({ ...current, fileManifest: [...manifest.values()] }, userId);
  }

  async readDevRuntime(projectId: string, userId?: string): Promise<DevRuntime> {
    const existing = await this.repository.getByProjectId(projectId, userId);
    return normalizeDevRuntime(existing?.devRuntime);
  }

  async patchDevRuntime(projectId: string, patch: Partial<DevRuntime>, userId?: string): Promise<DevRuntime> {
    const current = await this.readDevRuntime(projectId, userId);
    return this.saveDevRuntime(projectId, { ...current, ...patch }, userId);
  }

  async listDevRuntimes(): Promise<Array<{ projectId: string; userId?: string; devRuntime: DevRuntime }>> {
    const records = await this.repository.list();
    return records.map((record) => ({
      projectId: record.projectId,
      userId: record.userId,
      devRuntime: normalizeDevRuntime(record.devRuntime),
    }));
  }

  async saveDevRuntime(projectId: string, devRuntime: DevRuntime, userId?: string): Promise<DevRuntime> {
    const existing = await this.repository.getByProjectId(projectId, userId);
    if (existing) {
      await this.repository.save({ ...existing, devRuntime });
      return devRuntime;
    }
    const state = createEmptyProjectState(projectId);
    const now = new Date().toISOString();
    const saved = await this.repository.save({
      ...state,
      id: crypto.randomUUID(),
      userId,
      devRuntime,
      createdAt: now,
      updatedAt: now,
    });
    return saved.devRuntime ?? devRuntime;
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

function normalizeDevRuntime(devRuntime?: Partial<DevRuntime> | null): DevRuntime {
  return {
    ...EMPTY_DEV_RUNTIME,
    ...(devRuntime ?? {}),
    fixAttempts: devRuntime?.fixAttempts ?? EMPTY_DEV_RUNTIME.fixAttempts,
  };
}
