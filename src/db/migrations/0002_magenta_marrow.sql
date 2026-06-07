ALTER TABLE "builder_runs" ADD COLUMN "selected_skills" json DEFAULT '[]'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "builder_runs" ADD COLUMN "pending_skills" json DEFAULT '[]'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "builder_runs" ADD COLUMN "loaded_skills" json DEFAULT '[]'::json NOT NULL;