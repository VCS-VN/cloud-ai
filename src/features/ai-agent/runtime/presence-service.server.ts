import type { ProcessManager } from "./process-manager.server";

export type UserPresence = {
  userId: string;
  projectId: string;
  lastHeartbeatMs: number;
};

export type ProjectPresence = {
  projectId: string;
  users: Map<string, number>;
  idleTimerId?: ReturnType<typeof setTimeout>;
};

const IDLE_TIMEOUT_MS = 60_000;

class PresenceService {
  private projectPresence = new Map<string, ProjectPresence>();
  private processManager: ProcessManager | null = null;

  setProcessManager(pm: ProcessManager): void {
    this.processManager = pm;
  }

  registerUser(projectId: string, userId: string): void {
    let presence = this.projectPresence.get(projectId);
    if (!presence) {
      presence = {
        projectId,
        users: new Map(),
      };
      this.projectPresence.set(projectId, presence);
    }
    presence.users.set(userId, Date.now());
    if (presence.idleTimerId) {
      clearTimeout(presence.idleTimerId);
      presence.idleTimerId = undefined;
    }
  }

  unregisterUser(projectId: string, userId: string): void {
    const presence = this.projectPresence.get(projectId);
    if (!presence) return;
    presence.users.delete(userId);
    if (presence.users.size === 0) {
      this.startIdleTimer(projectId);
    }
  }

  processHeartbeat(projectId: string, userId: string): boolean {
    const presence = this.projectPresence.get(projectId);
    if (!presence) return false;
    presence.users.set(userId, Date.now());
    if (presence.idleTimerId) {
      clearTimeout(presence.idleTimerId);
      presence.idleTimerId = undefined;
    }
    return true;
  }

  private startIdleTimer(projectId: string): void {
    const presence = this.projectPresence.get(projectId);
    if (!presence) return;
    presence.idleTimerId = setTimeout(() => {
      this.terminateProjectProcess(projectId);
    }, IDLE_TIMEOUT_MS);
  }

  private async terminateProjectProcess(projectId: string): Promise<void> {
    if (this.processManager && this.processManager.isRunning(projectId)) {
      await this.processManager.stop(projectId);
    }
    this.projectPresence.delete(projectId);
  }

  getActiveUserCount(projectId: string): number {
    const presence = this.projectPresence.get(projectId);
    return presence?.users.size ?? 0;
  }
}

export const presenceService = new PresenceService();