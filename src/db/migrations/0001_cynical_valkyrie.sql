CREATE TABLE "builder_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"failure_code" text,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"draft_workspace_path" text,
	"selected_instructions" json DEFAULT '[]'::json NOT NULL,
	"pending_instructions" json DEFAULT '[]'::json NOT NULL,
	"commerce_validation_status" text DEFAULT 'skipped' NOT NULL,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_messages" ADD COLUMN "metadata" json;--> statement-breakpoint
CREATE INDEX "builder_runs_project_idx" ON "builder_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "builder_runs_user_idx" ON "builder_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "builder_runs_status_idx" ON "builder_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "builder_runs_kind_idx" ON "builder_runs" USING btree ("kind");