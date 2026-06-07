import { describe, expect, it, vi } from "vitest";
import { PgAgentRunRepository } from "@/server/repositories/agent-run-repository";

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

type Row = {
  id: string;
  status: string;
  failureCode: string | null;
  clarificationSnapshot: unknown;
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

describe("US6 — restart safety: streaming row → interrupted", () => {
  it("on boot, a streaming row with no live handle becomes failed/interrupted_by_restart", async () => {
    const db = new FakeDb([
      {
        id: "stranded",
        status: "streaming",
        failureCode: null,
        clarificationSnapshot: null,
        completedAt: null,
        updatedAt: new Date(0),
      },
    ]);
    const repo = new PgAgentRunRepository(db as never);
    const result = await repo.reconcileOrphanRuns({ isLiveHandle: () => false });
    expect(result.interruptedRunIds).toEqual(["stranded"]);
    const row = db.rows[0];
    expect(row.status).toBe("interrupted");
    expect(row.failureCode).toBe("interrupted_by_restart");
    expect(row.completedAt).toBeInstanceOf(Date);
  });

  it("a row with a live handle is left untouched even if its status is streaming", async () => {
    const db = new FakeDb([
      {
        id: "live",
        status: "streaming",
        failureCode: null,
        clarificationSnapshot: null,
        completedAt: null,
        updatedAt: new Date(0),
      },
    ]);
    const repo = new PgAgentRunRepository(db as never);
    const result = await repo.reconcileOrphanRuns({
      isLiveHandle: (id) => id === "live",
    });
    expect(result.interruptedRunIds).toEqual([]);
    expect(db.rows[0].status).toBe("streaming");
  });
});
