import { presenceService } from "./presence-service.server";

const DEFAULT_SWEEP_INTERVAL_MS = 30_000;

let sweeperHandle: ReturnType<typeof setInterval> | null = null;

export function startPresenceSweeper(intervalMs = DEFAULT_SWEEP_INTERVAL_MS): void {
  if (sweeperHandle) return;
  sweeperHandle = setInterval(() => {
    try {
      presenceService.expireStaleAcrossAllProjects();
    } catch (error) {
      console.error("Presence sweeper failed:", error);
    }
  }, intervalMs);
  if (typeof sweeperHandle === "object" && sweeperHandle !== null && "unref" in sweeperHandle) {
    (sweeperHandle as { unref: () => void }).unref();
  }
}

export function stopPresenceSweeper(): void {
  if (!sweeperHandle) return;
  clearInterval(sweeperHandle);
  sweeperHandle = null;
}
