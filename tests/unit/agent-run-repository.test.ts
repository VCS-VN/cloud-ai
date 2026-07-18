import { describe, expect, it } from "vitest";
import { PgAgentRunRepository, __testing } from "@/server/repositories/agent-run-repository";
import type {
  AgentRunClarificationSnapshot,
  AgentRunPlanPhase,
  AgentRunProgressTimelineEvent,
} from "@/features/projects/legacy/project-state.schema";

type Row = {
  id: string;
  userId: string;
  status: string;
  failureCode: string | null;
  progressTimeline: AgentRunProgressTimelineEvent[];
  planPhase: AgentRunPlanPhase | null;
  clarificationSnapshot: AgentRunClarificationSnapshot | null;
  kind: string | null;
  completedAt: Date | null;
  updatedAt: Date;
};

function rowDefaults(overrides: Partial<Row> & { id: string }): Row {
  return {
    userId: "user-1",
    status: "streaming",
    failureCode: null,
    progressTimeline: [],
    planPhase: null,
    clarificationSnapshot: null,
    kind: null,
    completedAt: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

class FakeDb {
  rows: Row[];
  filterPredicate: ((row: Row) => boolean) | null = null;
  pendingUpdate: Partial<Row> | null = null;

  constructor(initial: Row[]) {
    this.rows = initial;
  }

  select() {
    return {
      from: () => ({
        where: (predicate: Predicate) => {
          const rows = this.rows.filter((row) => matches(row, predicate));
          const result = Promise.resolve(rows) as Promise<Row[]> & { for: () => Promise<Row[]> };
          result.for = () => Promise.resolve(rows);
          return result;
        },
      }),
    };
  }

  update() {
    return {
      set: (values: Partial<Row>) => ({
        where: (predicate: Predicate) => {
          const rows = this.rows.filter((row) => matches(row, predicate));
          for (const row of rows) Object.assign(row, values);
          return {
            returning: () => Promise.resolve(rows.map(({ id }) => ({ id }))),
            then: (resolve: (value: void) => void) => Promise.resolve().then(resolve),
          };
        },
      }),
    };
  }

  transaction<T>(callback: (tx: FakeDb) => Promise<T>) {
    return callback(this);
  }
}

type Predicate =
  | { __eq: { col: keyof Row; value: unknown } }
  | { __in: { col: keyof Row; values: unknown[] } }
  | { __and: Predicate[] }
  | { __orphans: true };

function matches(row: Row, predicate: Predicate): boolean {
  if ("__eq" in predicate) return row[predicate.__eq.col] === predicate.__eq.value;
  if ("__in" in predicate) return predicate.__in.values.includes(row[predicate.__in.col]);
  if ("__and" in predicate) return predicate.__and.every((item) => matches(row, item));
  return row.status === "streaming" || row.status === "awaiting_input";
}

// Drizzle's eq/or builders return objects we just need to thread through to FakeDb.
// The repository uses eq(agentRuns.id, runId) for select, and or(eq(status,'streaming'),eq(status,'awaiting_input')) for orphans.
// We monkey-patch the predicates to expose a simple shape FakeDb understands.

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
      return { __eq: { col: colName, value } };
    },
    or: (...args: unknown[]) => {
      // Always treat or() in this repo as orphan filter (status streaming|awaiting_input)
      return { __orphans: true };
    },
    and: (...args: Predicate[]) => ({ __and: args }),
    inArray: (col: { name?: string }, values: unknown[]) => ({
      __in: { col: col.name ?? "?", values },
    }),
  };
});

vi.mock("@/db/schema", () => ({
  agentRuns: {
    id: { name: "id" },
    userId: { name: "userId" },
    status: { name: "status" },
    failureCode: { name: "failure_code" },
  },
  projectToolExecutionLogs: {},
}));

describe("PgAgentRunRepository — additive columns", () => {
  it("appends progress timeline events and caps at MAX_PROGRESS_TIMELINE_EVENTS (FIFO)", async () => {
    const cap = __testing.MAX_PROGRESS_TIMELINE_EVENTS;
    const initial: AgentRunProgressTimelineEvent[] = Array.from({ length: cap }, (_, i) => ({
      at: i,
      kind: "milestone",
      milestone: `milestone-${i}`,
    }));
    const db = new FakeDb([rowDefaults({ id: "run-1", progressTimeline: initial })]);
    const repo = new PgAgentRunRepository(db as never);

    const newest: AgentRunProgressTimelineEvent = {
      at: cap + 1,
      kind: "summary",
      text: "Đã hoàn tất.",
    };
    await repo.appendProgressTimelineEvent("run-1", "user-1", newest);

    const row = db.rows[0];
    expect(row.progressTimeline.length).toBe(cap);
    expect(row.progressTimeline.at(-1)).toEqual(newest);
    // FIFO drop: first event from the original timeline is gone.
    expect(row.progressTimeline.at(0)).toEqual({
      at: 1,
      kind: "milestone",
      milestone: "milestone-1",
    });
  });

  it("setPlanPhase + setClarificationSnapshot round-trip", async () => {
    const db = new FakeDb([rowDefaults({ id: "run-2" })]);
    const repo = new PgAgentRunRepository(db as never);

    const planPhase: AgentRunPlanPhase = {
      stage: "plan_ready",
      planMarkdown: "## Understanding\nfoo",
      planTurnDoneAt: 1000,
      planThreadId: "thread-1",
    };
    await repo.setPlanPhase("run-2", "user-1", planPhase, ["streaming"]);
    expect(db.rows[0].planPhase).toEqual(planPhase);

    const snapshot: AgentRunClarificationSnapshot = {
      questionType: "skill_clarification",
      options: [{ id: "opt-1", label: "Skill A" }],
      selectedOptionId: null,
      customAnswerAllowed: false,
      originalRunPrompt: "thêm image",
    };
    await repo.setClarificationSnapshot("run-2", "user-1", snapshot, ["streaming"]);
    expect(db.rows[0].clarificationSnapshot).toEqual(snapshot);

    await repo.setPlanPhase("run-2", "user-1", null, ["streaming"]);
    await repo.setClarificationSnapshot("run-2", "user-1", null, ["streaming"]);
    expect(db.rows[0].planPhase).toBeNull();
    expect(db.rows[0].clarificationSnapshot).toBeNull();
  });

  it("setStatus stamps completedAt for terminal statuses and sets failureCode", async () => {
    const db = new FakeDb([rowDefaults({ id: "run-3" })]);
    const repo = new PgAgentRunRepository(db as never);

    await repo.setStatus(
      "run-3",
      "user-1",
      "interrupted",
      ["streaming"],
      "interrupted_by_restart",
    );
    const row = db.rows[0];
    expect(row.status).toBe("interrupted");
    expect(row.failureCode).toBe("interrupted_by_restart");
    expect(row.completedAt).toBeInstanceOf(Date);
  });

  it("rejects mutation for wrong owner or unexpected status", async () => {
    const db = new FakeDb([rowDefaults({ id: "run-4", status: "completed" })]);
    const repo = new PgAgentRunRepository(db as never);

    expect(await repo.setStatus("run-4", "other-user", "failed", ["completed"])).toBe(false);
    expect(await repo.setStatus("run-4", "user-1", "failed", ["streaming"])).toBe(false);
    expect(db.rows[0].status).toBe("completed");
  });
});
