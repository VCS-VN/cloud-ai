import {
  getActiveRunForProject,
} from "./builder-run-registry.server";

export type ActiveRunLockState = {
  projectId: string;
  activeRunId: string | null;
};

export function inspectActiveRunLock(projectId: string): ActiveRunLockState {
  return {
    projectId,
    activeRunId: getActiveRunForProject(projectId) ?? null,
  };
}

export function isProjectLocked(projectId: string): boolean {
  return inspectActiveRunLock(projectId).activeRunId !== null;
}

/**
 * The active-run lock itself is owned by builder-run-registry.server.ts so the
 * registry stays the single source of truth for run state. This module exposes
 * read-only helpers and re-exports the existing reservation primitives so call
 * sites that only care about concurrency policy do not need to import the
 * registry directly.
 */
export {
  ActiveRunExistsError,
  createBuilderRunHandle,
} from "./builder-run-registry.server";
