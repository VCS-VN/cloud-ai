import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_RETAIN_MS,
  buildRetentionRecord,
  deleteDraftAfterPromote,
  ensureNoLeak,
  gcDraftRetention,
  type DraftRetentionRecord,
  type RetentionStore,
} from "@/features/agents/codex/retention/draft-retention.server";

describe("buildRetentionRecord", () => {
  const baseInput = {
    runId: "run-123",
    draftWorkspacePath: "/tmp/draft-123",
  };

  it("returns retainUntil = now + DEFAULT_RETAIN_MS for cancelled, restricted=false", () => {
    const now = 1_700_000_000_000;
    const record = buildRetentionRecord({
      ...baseInput,
      reason: "cancelled",
      now,
    });
    expect(record.retainUntil).toBe(now + DEFAULT_RETAIN_MS);
    expect(record.restricted).toBe(false);
    expect(record.reason).toBe("cancelled");
    expect(record.runId).toBe("run-123");
  });

  it("validation_failed → restricted=false, retain 12h", () => {
    const now = 1_700_000_000_000;
    const record = buildRetentionRecord({
      ...baseInput,
      reason: "validation_failed",
      now,
    });
    expect(record.restricted).toBe(false);
    expect(record.retainUntil - now).toBe(12 * 60 * 60 * 1000);
  });

  it("boundary_violation → restricted=true, retain 12h", () => {
    const now = 1_700_000_000_000;
    const record = buildRetentionRecord({
      ...baseInput,
      reason: "boundary_violation",
      now,
    });
    expect(record.restricted).toBe(true);
    expect(record.retainUntil - now).toBe(12 * 60 * 60 * 1000);
  });

  it("promoted → retainUntil === now (immediate cleanup)", () => {
    const now = 1_700_000_000_000;
    const record = buildRetentionRecord({
      ...baseInput,
      reason: "promoted",
      now,
    });
    expect(record.retainUntil).toBe(now);
    expect(record.restricted).toBe(false);
  });
});

describe("gcDraftRetention", () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "draft-retention-"));
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("purges expired records, removes from store, and deletes draft directory", async () => {
    const draftDir = path.join(tempRoot, "expired-draft");
    await fs.mkdir(draftDir, { recursive: true });
    await fs.writeFile(path.join(draftDir, "file.txt"), "data");

    const now = 1_700_000_000_000;
    const record: DraftRetentionRecord = {
      runId: "run-expired",
      draftWorkspacePath: draftDir,
      reason: "cancelled",
      retainUntil: now - 1000,
      restricted: false,
    };

    const removed: string[] = [];
    const store: RetentionStore = {
      list: async () => [record],
      remove: async (runId: string) => {
        removed.push(runId);
      },
    };

    const result = await gcDraftRetention({ store, now });

    expect(result.purged).toEqual(["run-expired"]);
    expect(removed).toEqual(["run-expired"]);
    await expect(fs.access(draftDir)).rejects.toThrow();
  });

  it("does not purge records that have not yet expired", async () => {
    const draftDir = path.join(tempRoot, "fresh-draft");
    await fs.mkdir(draftDir, { recursive: true });
    await fs.writeFile(path.join(draftDir, "file.txt"), "data");

    const now = 1_700_000_000_000;
    const record: DraftRetentionRecord = {
      runId: "run-fresh",
      draftWorkspacePath: draftDir,
      reason: "cancelled",
      retainUntil: now + 60_000,
      restricted: false,
    };

    const removed: string[] = [];
    const store: RetentionStore = {
      list: async () => [record],
      remove: async (runId: string) => {
        removed.push(runId);
      },
    };

    const result = await gcDraftRetention({ store, now });

    expect(result.purged).toEqual([]);
    expect(removed).toEqual([]);
    await expect(fs.access(draftDir)).resolves.toBeUndefined();
  });
});

describe("deleteDraftAfterPromote", () => {
  it("removes the draft directory", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "draft-promote-"));
    try {
      const draftDir = path.join(root, "promoted-draft");
      await fs.mkdir(draftDir, { recursive: true });
      await fs.writeFile(path.join(draftDir, "file.txt"), "data");

      await deleteDraftAfterPromote(draftDir);

      await expect(fs.access(draftDir)).rejects.toThrow();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("is a no-op for empty path", async () => {
    await expect(deleteDraftAfterPromote("")).resolves.toBeUndefined();
  });
});

describe("ensureNoLeak", () => {
  it("throws when draftWorkspacePath is outside allowedRoot", () => {
    const record: DraftRetentionRecord = {
      runId: "run-leak",
      draftWorkspacePath: "/var/tmp/escape",
      reason: "cancelled",
      retainUntil: 0,
      restricted: false,
    };
    expect(() => ensureNoLeak(record, "/var/data/drafts")).toThrow(
      "retention_record_outside_allowed_root",
    );
  });

  it("does not throw when draftWorkspacePath is inside allowedRoot", () => {
    const allowedRoot = "/var/data/drafts";
    const record: DraftRetentionRecord = {
      runId: "run-ok",
      draftWorkspacePath: path.join(allowedRoot, "run-ok"),
      reason: "cancelled",
      retainUntil: 0,
      restricted: false,
    };
    expect(() => ensureNoLeak(record, allowedRoot)).not.toThrow();
  });
});
