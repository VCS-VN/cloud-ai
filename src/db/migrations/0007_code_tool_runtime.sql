ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "code_tool_run_state" jsonb;

CREATE TABLE IF NOT EXISTS "project_tool_execution_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "message_id" text NOT NULL,
  "tool_name" text NOT NULL,
  "category" text NOT NULL,
  "status" text NOT NULL,
  "safe_args_summary" text NOT NULL,
  "safe_result_summary" text,
  "error_code" text,
  "recoverable" boolean,
  "metadata" jsonb,
  "started_at" timestamp NOT NULL,
  "completed_at" timestamp,
  "duration_ms" integer
);

CREATE INDEX IF NOT EXISTS "project_tool_logs_project_message_idx" ON "project_tool_execution_logs" ("project_id", "message_id");
CREATE INDEX IF NOT EXISTS "project_tool_logs_tool_idx" ON "project_tool_execution_logs" ("tool_name");
CREATE INDEX IF NOT EXISTS "project_tool_logs_status_idx" ON "project_tool_execution_logs" ("status");
