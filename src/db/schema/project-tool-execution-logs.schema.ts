import { index, jsonb, pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const projectToolExecutionLogs = pgTable(
  "project_tool_execution_logs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    messageId: text("message_id").notNull(),
    toolName: text("tool_name").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull(),
    safeArgsSummary: text("safe_args_summary").notNull(),
    safeResultSummary: text("safe_result_summary"),
    errorCode: text("error_code"),
    recoverable: boolean("recoverable"),
    metadata: jsonb("metadata"),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
    durationMs: integer("duration_ms"),
  },
  (table) => ({
    projectMessageIdx: index("project_tool_logs_project_message_idx").on(table.projectId, table.messageId),
    toolIdx: index("project_tool_logs_tool_idx").on(table.toolName),
    statusIdx: index("project_tool_logs_status_idx").on(table.status),
  }),
);
