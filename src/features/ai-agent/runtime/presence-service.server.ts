import type { ProcessManager } from "./process-manager.server";
import type { DevRuntime } from "@/features/ai-agent/project/project-state.schema";

export type PresenceLeaveReason = "leave" | "blur" | "hidden" | "unload" | "expired";

export type PresenceEntry = {
  presenceId: string;
  userId: string;
  projectId: string;
  focused: boolean;
  lastHeartbeatMs: number;
  lastSignalMs: number;
};

export type RuntimeStateStoreForPresence = {
  readDevRuntime: (projectId: string) => Promise<DevRuntime>;
  saveDevRuntime: (projectId: string, devRuntime: DevRuntime) => Promise<unknown>;
};

export type ProjectPresence = {
  projectId: string;
  entries: Map<string, PresenceEntry>;
  idleTimerId?: ReturnType<typeof setTimeout>;
};

const IDLE_TIMEOUT_MS = 60_000;
const HEARTBEAT_TTL_MS = 75_000;

class PresenceService {
  private projectPresence = new Map<string, ProjectPresence>();
  private processManager: ProcessManager | null = null;
  private runtimeStore: RuntimeStateStoreForPresence | null = null;

  setProcessManager(pm: ProcessManager): void {
    this.processManager = pm;
  }

  setRuntimeStore(store: RuntimeStateStoreForPresence): void {
    this.runtimeStore = store;
  }

  registerPresence(projectId: string, userId: string, presenceId: string): void {
    const presence = this.getOrCreateProjectPresence(projectId);
    const now = Date.now();
    presence.entries.set(presenceId, {
      presenceId,
      userId,
      projectId,
      focused: true,
      lastHeartbeatMs: now,
      lastSignalMs: now,
    });
    this.cancelIdleTimer(presence);
  }

  leavePresence(projectId: string, presenceId: string, _reason: PresenceLeaveReason = "leave"): void {
    const presence = this.projectPresence.get(projectId);
    if (!presence) return;
    presence.entries.delete(presenceId);
    if (this.getActivePresenceCount(projectId) === 0) {
      this.startIdleTimer(projectId);
    }
  }

  processHeartbeat(projectId: string, userId: string, presenceId: string): boolean {
    const presence = this.getOrCreateProjectPresence(projectId);
    const now = Date.now();
    const existing = presence.entries.get(presenceId);
    presence.entries.set(presenceId, {
      presenceId,
      userId,
      projectId,
      focused: true,
      lastHeartbeatMs: now,
      lastSignalMs: existing?.lastSignalMs ?? now,
    });
    this.cancelIdleTimer(presence);
    return Boolean(existing);
  }

  expireStalePresence(projectId: string, now = Date.now()): number {
    const presence = this.projectPresence.get(projectId);
    if (!presence) return 0;
    let expiredCount = 0;
    for (const entry of presence.entries.values()) {
      if (now - entry.lastHeartbeatMs > HEARTBEAT_TTL_MS) {
        presence.entries.delete(entry.presenceId);
        expiredCount++;
      }
    }
    if (presence.entries.size === 0) {
      this.startIdleTimer(projectId);
    }
    return expiredCount;
  }

  expireStaleAcrossAllProjects(now = Date.now()): number {
    let total = 0;
    for (const projectId of this.projectPresence.keys()) {
      total += this.expireStalePresence(projectId, now);
    }
    return total;
  }

  getActivePresenceCount(projectId: string): number {
    const presence = this.projectPresence.get(projectId);
    if (!presence) return 0;
    return [...presence.entries.values()].filter((entry) => entry.focused).length;
  }

  // Backward-compatible wrappers for existing call sites/tests until client hook migration.
  registerUser(projectId: string, userId: string): void {
    this.registerPresence(projectId, userId, userId);
  }

  unregisterUser(projectId: string, userId: string): void {
    this.leavePresence(projectId, userId);
  }

  getActiveUserCount(projectId: string): number {
    return this.getActivePresenceCount(projectId);
  }

  private getOrCreateProjectPresence(projectId: string): ProjectPresence {
    let presence = this.projectPresence.get(projectId);
    if (!presence) {
      presence = {
        projectId,
        entries: new Map(),
      };
      this.projectPresence.set(projectId, presence);
    }
    return presence;
  }

  private cancelIdleTimer(presence: ProjectPresence): void {
    if (presence.idleTimerId) {
      clearTimeout(presence.idleTimerId);
      presence.idleTimerId = undefined;
    }
  }

  private startIdleTimer(projectId: string): void {
    const presence = this.projectPresence.get(projectId);
    if (!presence || presence.idleTimerId) return;
    presence.idleTimerId = setTimeout(() => {
      void this.terminateProjectProcess(projectId);
    }, IDLE_TIMEOUT_MS);
  }

  private async terminateProjectProcess(projectId: string): Promise<void> {
    if (this.processManager?.isRunning(projectId)) {
      await this.processManager.stop(projectId);
    }
    if (this.runtimeStore) {
      const runtime = await this.runtimeStore.readDevRuntime(projectId);
      await this.runtimeStore.saveDevRuntime(projectId, {
        ...runtime,
        status: "stopped",
        pid: null,
      });
    }
    this.projectPresence.delete(projectId);
  }
}

export const presenceService = new PresenceService();
