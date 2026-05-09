CREATE TABLE IF NOT EXISTS "project_states" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "user_id" text,
  "status" text NOT NULL,
  "stack" jsonb NOT NULL,
  "package_policy" jsonb NOT NULL,
  "ecommerce_spec" jsonb NOT NULL,
  "brand" jsonb NOT NULL,
  "pages" jsonb NOT NULL,
  "features" jsonb NOT NULL,
  "constraints" jsonb NOT NULL,
  "file_manifest" jsonb NOT NULL,
  "decision_log" jsonb NOT NULL,
  "recent_changes" jsonb NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_states_project_idx" ON "project_states" ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_states_user_idx" ON "project_states" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "user_id" text,
  "message_id" text,
  "parent_message_id" text,
  "user_prompt" text NOT NULL,
  "intent" jsonb,
  "plan" jsonb,
  "status" text NOT NULL,
  "model_usage" jsonb,
  "affected_files" jsonb NOT NULL,
  "validation_result" jsonb,
  "error" jsonb,
  "started_at" timestamp NOT NULL,
  "completed_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_project_idx" ON "agent_runs" ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_user_idx" ON "agent_runs" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_message_idx" ON "agent_runs" ("message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_status_idx" ON "agent_runs" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "user_id" text,
  "run_id" text,
  "kind" text NOT NULL,
  "summary" text NOT NULL,
  "project_state" jsonb NOT NULL,
  "file_manifest" jsonb NOT NULL,
  "workspace_revision_id" text,
  "created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_snapshots_project_idx" ON "project_snapshots" ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_snapshots_run_idx" ON "project_snapshots" ("run_id");
