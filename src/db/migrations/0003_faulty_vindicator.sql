CREATE TABLE "agent_message_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"message_id" text NOT NULL,
	"user_id" text,
	"sequence" integer NOT NULL,
	"content" text NOT NULL,
	"provider_event_type" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "storefront_projects" ADD COLUMN "processing_status" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "storefront_projects" ADD COLUMN "active_agent_message_id" text;--> statement-breakpoint
ALTER TABLE "storefront_projects" ADD COLUMN "processing_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_messages" ADD COLUMN "parent_message_id" text;--> statement-breakpoint
ALTER TABLE "project_messages" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "project_messages" ADD COLUMN "provider_response_id" text;--> statement-breakpoint
ALTER TABLE "project_messages" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "project_messages" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_messages" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "project_messages" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_message_chunks_message_sequence_idx" ON "agent_message_chunks" USING btree ("message_id","sequence");
