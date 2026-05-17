import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  description: text("description"),
  initialPrompt: text("initial_prompt"),
  status: integer("status").notNull().default(1),
  processingStatus: text("processing_status").notNull().default("idle"),
  activeAgentMessageId: text("active_agent_message_id"),
  processingStartedAt: timestamp("processing_started_at"),
  currentRevisionId: text("current_revision_id"),
  selectedStoreSlug: text("selected_store_slug"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
