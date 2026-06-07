ALTER TABLE "agent_runs" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "failure_code" text;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "progress_timeline" json DEFAULT '[]'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "plan_phase" json;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "clarification_snapshot" json;--> statement-breakpoint
CREATE INDEX "agent_runs_kind_idx" ON "agent_runs" USING btree ("kind");