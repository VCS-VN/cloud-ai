import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const projectSnapshots = pgTable(
  "project_snapshots",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    userId: text("user_id"),
    runId: text("run_id"),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    projectState: jsonb("project_state").notNull(),
    fileManifest: jsonb("file_manifest").notNull(),
    workspaceRevisionId: text("workspace_revision_id"),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({
    projectIdx: index("project_snapshots_project_idx").on(table.projectId),
    runIdx: index("project_snapshots_run_idx").on(table.runId),
  }),
);
