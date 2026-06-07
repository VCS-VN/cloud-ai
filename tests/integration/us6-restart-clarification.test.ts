import { describe, expect, it, vi } from "vitest";
import { PgAgentRunRepository } from "@/server/repositories/agent-run-repository";
import type { AgentRunClarificationSnapshot } from "@/features/projects/legacy/project-state.schema";

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

describe("US6 — restart safety: awaiting_clarification recovery", () => {
  it("an awaiting_input row with a clarification snapshot is preserved (recoverable)", async () => {
    const snapshot: AgentRunClarificationSnapshot = {
      questionType: "design_variant",
      options: [{ id: "v1" }, { id: "v2" }, { id: "v3" }, { id: "v4" }],
      selectedOptionId: null,
      customAnswerAllowed: true,
      originalRunPrompt: "init prompt",
    };
    const db = new FakeDb([
      {
        id: "recoverable",
        status: "awaiting_input",
        failureCode: null,
        clarificationSnapshot: snapshot,
        completedAt: null,
        updatedAt: new Date(0),
      },
    ]);
    const repo = new PgAgentRunRepository(db as never);
    const result = await repo.reconcileOrphanRuns({ isLiveHandle: () => false });
    expect(result.recoveredAwaitingClarificationRunIds).toEqual(["recoverable"]);
    expect(db.rows[0].status).toBe("awaiting_input");
    expect(db.rows[0].clarificationSnapshot).toEqual(snapshot);
  });

  it("plan_review snapshot is also recovered (not flipped to interrupted)", async () => {
    const snapshot: AgentRunClarificationSnapshot = {
      questionType: "plan_review",
      planMarkdown: "## Understanding\n...\n",
      selectedAction: null,
      originalRunPrompt: "thêm image",
    };
    const db = new FakeDb([
      {
        id: "plan-paused",
        status: "awaiting_input",
        failureCode: null,
        clarificationSnapshot: snapshot,
        completedAt: null,
        updatedAt: new Date(0),
      },
    ]);
    const repo = new PgAgentRunRepository(db as never);
    const result = await repo.reconcileOrphanRuns({ isLiveHandle: () => false });
    expect(result.recoveredAwaitingClarificationRunIds).toEqual(["plan-paused"]);
  });

  it("an awaiting_input row with NO snapshot is conservatively flipped to interrupted", async () => {
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
  });
});
