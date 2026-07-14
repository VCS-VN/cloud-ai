CREATE TABLE "runner_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"project_id" text NOT NULL,
	"role" text DEFAULT 'agent' NOT NULL,
	"content" text NOT NULL,
	"kind" text,
	"processing_status" text DEFAULT 'completed' NOT NULL,
	"metadata" json,
	"provider_response_id" text,
	"error_message" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "runner_messages_run_idx" ON "runner_messages" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "runner_messages_run_created_idx" ON "runner_messages" USING btree ("run_id","created_at");