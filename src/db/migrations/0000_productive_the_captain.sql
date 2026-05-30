CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_uid" text NOT NULL,
	"password" text,
	"api_key" text,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"display_name" text,
	"photo_url" text,
	"provider" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"last_login_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"description" text,
	"initial_prompt" text,
	"status" integer DEFAULT 1 NOT NULL,
	"processing_status" text DEFAULT 'idle' NOT NULL,
	"active_run_id" text,
	"processing_started_at" timestamp,
	"current_revision_id" text,
	"selected_store_slug" text,
	"data" jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text,
	"data" jsonb NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_records" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text,
	"revision_id" text,
	"data" jsonb NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preview_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"revision_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"processing_status" text DEFAULT 'completed' NOT NULL,
	"parent_message_id" text,
	"run_id" text,
	"kind" text,
	"provider" text,
	"provider_response_id" text,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "project_file_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"path" text NOT NULL,
	"parent_id" text,
	"content_type" text,
	"content" text,
	"metadata" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_states" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text,
	"status" text NOT NULL,
	"stack" json NOT NULL,
	"package_policy" json NOT NULL,
	"ecommerce_spec" json NOT NULL,
	"brand" json NOT NULL,
	"pages" json NOT NULL,
	"features" json NOT NULL,
	"constraints" json NOT NULL,
	"file_manifest" json NOT NULL,
	"decision_log" json NOT NULL,
	"recent_changes" json NOT NULL,
	"dev_runtime" json DEFAULT '{"status":"stopped","enabled":false,"pid":null,"port":null,"previewHost":null,"cloudflareDnsRecordId":null,"dnsStatus":"none","installStatus":"idle","installStartedAt":null,"installCompletedAt":null,"devStartedAt":null,"previewUrl":null,"lastAccessedAt":null,"installLog":null,"devLog":null,"lastError":null,"lastErrorTier":null,"retryCount":0,"maxRetries":3,"operatorAttentionRequired":false,"fixAttempts":[]}'::json NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text,
	"parent_message_id" text,
	"retry_of_run_id" text,
	"user_prompt" text NOT NULL,
	"reasoning_effort" text,
	"plan_mode" boolean DEFAULT false NOT NULL,
	"intent" json,
	"plan" json,
	"status" text NOT NULL,
	"model_usage" json,
	"thinking" json,
	"affected_files" json NOT NULL,
	"validation_result" json,
	"code_tool_run_state" json,
	"error" json,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_snapshots" (
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
CREATE TABLE "project_tool_execution_logs" (
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
--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_uid_idx" ON "users" USING btree ("provider_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "project_messages_project_run_idx" ON "project_messages" USING btree ("project_id","run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_states_project_idx" ON "project_states" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_states_user_idx" ON "project_states" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_runs_project_idx" ON "agent_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "agent_runs_user_idx" ON "agent_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_runs_retry_idx" ON "agent_runs" USING btree ("retry_of_run_id");--> statement-breakpoint
CREATE INDEX "agent_runs_status_idx" ON "agent_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_snapshots_project_idx" ON "project_snapshots" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_snapshots_run_idx" ON "project_snapshots" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "project_tool_logs_project_message_idx" ON "project_tool_execution_logs" USING btree ("project_id","message_id");--> statement-breakpoint
CREATE INDEX "project_tool_logs_tool_idx" ON "project_tool_execution_logs" USING btree ("tool_name");--> statement-breakpoint
CREATE INDEX "project_tool_logs_status_idx" ON "project_tool_execution_logs" USING btree ("status");