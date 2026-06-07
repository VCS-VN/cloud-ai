import { describe, expect, it, vi } from "vitest";
import { PgAgentRunRepository } from "@/server/repositories/agent-run-repository";
import type { AgentRunClarificationSnapshot } from "@/features/projects/legacy/project-state.schema";

type Row = {
  id: string;
  status: string;
  failureCode: string | null;
  clarificationSnapshot: AgentRunClarificationSnapshot | null;
  completedAt: Date | null;
  updatedAt: Date;
};

class FakeDb {
  constructor(public rows: Row[]) {}

  select() {
    return {
      from: () => ({
        where: () =>
          Promise.resolve(
            this.rows.filter(
              (r) => r.status === "streaming" || r.status === "awaiting_input",
            ),
          ),
      }),
    };
  }

  update() {
    return {
      set: (values: Partial<Row>) => ({
        where: (predicate: { __runId: string }) => {
          const row = this.rows.find((r) => r.id === predicate.__runId);
          if (row) Object.assign(row, values);
          return Promise.resolve();
        },
      }),
    };
  }
}

vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm")) as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    eq: (col: unknown, value: unknown) => {
      const colName =
        typeof col === "string"
          ? col
          : (col as { name?: string } | undefined)?.name ?? "?";
      if (colName === "id") return { __runId: value };
      return { __eq: { col: colName, value } };
    },
    or: () => ({ __orphans: true }),
    and: (...args: unknown[]) => args[0],
  };
});

vi.mock("@/db/schema", () => ({
  agentRuns: {
    id: { name: "id" },
    status: { name: "status" },
    failureCode: { name: "failure_code" },
  },
  projectToolExecutionLogs: {},
}));

describe("reconcileOrphanRuns", () => {
  it("flips streaming-without-handle to interrupted/interrupted_by_restart", async () => {
    const db = new FakeDb([
      {
        id: "orphan",
        status: "streaming",
        failureCode: null,
        clarificationSnapshot: null,
        completedAt: null,
        updatedAt: new Date(0),
      },
    ]);
    const repo = new PgAgentRunRepository(db as never);
    const result = await repo.reconcileOrphanRuns({
      isLiveHandle: () => false,
    });
    expect(result.interruptedRunIds).toEqual(["orphan"]);
    expect(result.recoveredAwaitingClarificationRunIds).toEqual([]);
    const row = db.rows[0];
    expect(row.status).toBe("interrupted");
    expect(row.failureCode).toBe("interrupted_by_restart");
    expect(row.completedAt).toBeInstanceOf(Date);
  });

  it("preserves awaiting_input rows that have a clarification snapshot (recoverable)", async () => {
    const snapshot: AgentRunClarificationSnapshot = {
      questionType: "design_variant",
      options: [],
      selectedOptionId: null,
      customAnswerAllowed: true,
      originalRunPrompt: "init prompt",
    };
    const db = new FakeDb([
      {
        id: "awaiting",
        status: "awaiting_input",
        failureCode: null,
        clarificationSnapshot: snapshot,
        completedAt: null,
        updatedAt: new Date(0),
      },
    ]);
    const repo = new PgAgentRunRepository(db as never);
    const result = await repo.reconcileOrphanRuns({ isLiveHandle: () => false });
    expect(result.recoveredAwaitingClarificationRunIds).toEqual(["awaiting"]);
    expect(result.interruptedRunIds).toEqual([]);
    expect(db.rows[0].status).toBe("awaiting_input");
  });

  it("flips awaiting_input without snapshot to interrupted (not recoverable)", async () => {
    const db = new FakeDb([
      {
        id: "stranded",
        status: "awaiting_input",
        failureCode: null,
        clarificationSnapshot: null,
        completedAt: null,
        updatedAt: new Date(0),
      },
    ]);
    const repo = new PgAgentRunRepository(db as never);
    const result = await repo.reconcileOrphanRuns({ isLiveHandle: () => false });
    expect(result.interruptedRunIds).toEqual(["stranded"]);
    expect(db.rows[0].status).toBe("interrupted");
    expect(db.rows[0].failureCode).toBe("interrupted_by_restart");
  });

  it("leaves rows alone when their handle is live", async () => {
    const db = new FakeDb([
      {
        id: "alive",
        status: "streaming",
        failureCode: null,
        clarificationSnapshot: null,
        completedAt: null,
        updatedAt: new Date(0),
      },
    ]);
    const repo = new PgAgentRunRepository(db as never);
    const result = await repo.reconcileOrphanRuns({
      isLiveHandle: (id) => id === "alive",
    });
    expect(result.interruptedRunIds).toEqual([]);
    expect(db.rows[0].status).toBe("streaming");
    expect(db.rows[0].completedAt).toBeNull();
  });

  it("ignores already-terminal rows (only streaming + awaiting_input are scanned)", async () => {
    const db = new FakeDb([
      {
        id: "completed",
        status: "completed",
        failureCode: null,
        clarificationSnapshot: null,
        completedAt: new Date(0),
        updatedAt: new Date(0),
      },
    ]);
    const repo = new PgAgentRunRepository(db as never);
    const result = await repo.reconcileOrphanRuns({ isLiveHandle: () => false });
    expect(result.interruptedRunIds).toEqual([]);
    expect(result.recoveredAwaitingClarificationRunIds).toEqual([]);
    expect(db.rows[0].status).toBe("completed");
  });
});
