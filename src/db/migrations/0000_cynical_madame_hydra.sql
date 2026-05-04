CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"display_name" text,
	"photo_url" text,
	"auth_provider" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"last_login_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storefront_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"current_revision_id" text,
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
	"status" text NOT NULL,
	"created_at" timestamp NOT NULL
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
CREATE UNIQUE INDEX "users_firebase_uid_idx" ON "users" USING btree ("firebase_uid");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");