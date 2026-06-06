import {
  index,
  json,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const builderRuns = pgTable(
  "builder_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    userId: text("user_id"),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    failureCode: text("failure_code"),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
    draftWorkspacePath: text("draft_workspace_path"),
    selectedInstructions: json("selected_instructions").notNull().default([]),
    pendingInstructions: json("pending_instructions").notNull().default([]),
    commerceValidationStatus: text("commerce_validation_status")
      .notNull()
      .default("skipped"),
    metadata: json("metadata").notNull().default({}),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => ({
    projectIdx: index("builder_runs_project_idx").on(table.projectId),
    userIdx: index("builder_runs_user_idx").on(table.userId),
    statusIdx: index("builder_runs_status_idx").on(table.status),
    kindIdx: index("builder_runs_kind_idx").on(table.kind),
  }),
);
