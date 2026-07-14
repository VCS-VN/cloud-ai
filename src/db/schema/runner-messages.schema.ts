import { index, json, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const runnerMessages = pgTable(
  "runner_messages",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    projectId: text("project_id").notNull(),
    role: text("role").notNull().default("agent"),
    content: text("content").notNull(),
    kind: text("kind"),
    processingStatus: text("processing_status").notNull().default("completed"),
    metadata: json("metadata"),
    providerResponseId: text("provider_response_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (table) => ({
    runIdx: index("runner_messages_run_idx").on(table.runId),
    runCreatedIdx: index("runner_messages_run_created_idx").on(
      table.runId,
      table.createdAt,
    ),
  }),
);
