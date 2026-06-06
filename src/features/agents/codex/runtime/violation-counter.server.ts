export const PROJECT_VIOLATION_SUSPEND_THRESHOLD = 3;
export const USER_VIOLATION_ESCALATE_THRESHOLD = 5;

export type ViolationLayer =
  | "path_guard"
  | "symlink"
  | "diff_gate"
  | "promotion_gate"
  | "filesystem_audit";

export type ProjectViolationState = {
  projectId: string;
  count: number;
  suspended: boolean;
  lastAt: number;
};

export type UserViolationState = {
  userId: string;
  count: number;
  escalated: boolean;
  lastAt: number;
};

const projectState = new Map<string, ProjectViolationState>();
const userState = new Map<string, UserViolationState>();

export type RecordViolationInput = {
  projectId: string;
  userId: string | undefined;
  layer: ViolationLayer;
  now?: number;
};

export type RecordViolationResult = {
  project: ProjectViolationState;
  user: UserViolationState | null;
  suspended: boolean;
  escalated: boolean;
};

export function recordBoundaryViolation(
  input: RecordViolationInput,
): RecordViolationResult {
  const now = input.now ?? Date.now();
  const project = projectState.get(input.projectId) ?? {
    projectId: input.projectId,
    count: 0,
    suspended: false,
    lastAt: 0,
  };
  project.count += 1;
  project.lastAt = now;
  if (project.count >= PROJECT_VIOLATION_SUSPEND_THRESHOLD) {
    project.suspended = true;
  }
  projectState.set(input.projectId, project);

  let user: UserViolationState | null = null;
  if (input.userId) {
    user = userState.get(input.userId) ?? {
      userId: input.userId,
      count: 0,
      escalated: false,
      lastAt: 0,
    };
    user.count += 1;
    user.lastAt = now;
    if (user.count >= USER_VIOLATION_ESCALATE_THRESHOLD) {
      user.escalated = true;
    }
    userState.set(input.userId, user);
  }

  return {
    project,
    user,
    suspended: project.suspended,
    escalated: user?.escalated ?? false,
  };
}

export function getProjectViolationState(
  projectId: string,
): ProjectViolationState | null {
  return projectState.get(projectId) ?? null;
}

export function isProjectSuspended(projectId: string): boolean {
  return projectState.get(projectId)?.suspended === true;
}

export function resetViolationStateForTest(): void {
  projectState.clear();
  userState.clear();
}
