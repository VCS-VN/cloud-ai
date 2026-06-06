import fs from "node:fs/promises";
import path from "node:path";

export type DraftRetentionReason =
  | "cancelled"
  | "validation_failed"
  | "boundary_violation"
  | "promoted";

export type DraftRetentionRecord = {
  runId: string;
  draftWorkspacePath: string;
  reason: DraftRetentionReason;
  retainUntil: number;
  restricted: boolean;
};

export const DEFAULT_RETAIN_MS = 12 * 60 * 60 * 1000;
export const RETENTION_TICK_MS = 30 * 60 * 1000;

export function buildRetentionRecord(input: {
  runId: string;
  draftWorkspacePath: string;
  reason: DraftRetentionReason;
  now: number;
}): DraftRetentionRecord {
  const restricted = input.reason === "boundary_violation";
  return {
    runId: input.runId,
    draftWorkspacePath: input.draftWorkspacePath,
    reason: input.reason,
    retainUntil:
      input.reason === "promoted" ? input.now : input.now + DEFAULT_RETAIN_MS,
    restricted,
  };
}

export type RetentionStore = {
  list(): Promise<DraftRetentionRecord[]>;
  remove(runId: string): Promise<void>;
};

export async function deleteDraftDirectory(draftPath: string): Promise<void> {
  if (!draftPath) return;
  await fs.rm(draftPath, { recursive: true, force: true });
}

export async function gcDraftRetention(input: {
  store: RetentionStore;
  now: number;
}): Promise<{ purged: string[] }> {
  const records = await input.store.list();
  const purged: string[] = [];
  for (const record of records) {
    if (record.retainUntil > input.now) continue;
    await deleteDraftDirectory(record.draftWorkspacePath);
    await input.store.remove(record.runId);
    purged.push(record.runId);
  }
  return { purged };
}

export async function deleteDraftAfterPromote(
  draftWorkspacePath: string,
): Promise<void> {
  if (!draftWorkspacePath) return;
  await fs.rm(draftWorkspacePath, { recursive: true, force: true });
}

export function ensureNoLeak(record: DraftRetentionRecord, allowedRoot: string): void {
  const resolved = path.resolve(record.draftWorkspacePath);
  const root = path.resolve(allowedRoot);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("retention_record_outside_allowed_root");
  }
}
