import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  json,
} from "drizzle-orm/pg-core";

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    userId: text("user_id"),
    messageId: text("message_id"),
    parentMessageId: text("parent_message_id"),
    userPrompt: text("user_prompt").notNull(),
    intent: jsonb("intent"),
    plan: jsonb("plan"),
    status: text("status").notNull(),
    modelUsage: jsonb("model_usage"),
    thinking: json("thinking"),
    affectedFiles: jsonb("affected_files").notNull(),
    validationResult: jsonb("validation_result"),
    codeToolRunState: jsonb("code_tool_run_state"),
    error: jsonb("error"),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => ({
    projectIdx: index("agent_runs_project_idx").on(table.projectId),
    userIdx: index("agent_runs_user_idx").on(table.userId),
    messageIdx: index("agent_runs_message_idx").on(table.messageId),
    statusIdx: index("agent_runs_status_idx").on(table.status),
  }),
);
