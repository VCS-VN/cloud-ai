ALTER TABLE "storefront_projects" ADD COLUMN "description" text;
ALTER TABLE "storefront_projects" ADD COLUMN "initial_prompt" text;
ALTER TABLE "storefront_projects" ADD COLUMN "status" integer DEFAULT 1 NOT NULL;
ALTER TABLE "project_messages" ALTER COLUMN "status" TYPE integer USING CASE WHEN "status" = 'inactive' OR "status" = '0' THEN 0 ELSE 1 END;
ALTER TABLE "project_messages" ALTER COLUMN "status" SET DEFAULT 1;
ALTER TABLE "project_messages" ADD COLUMN "processing_status" text DEFAULT 'completed' NOT NULL;
