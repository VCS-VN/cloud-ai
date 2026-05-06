import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const storefrontProjects = pgTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  description: text("description"),
  initialPrompt: text("initial_prompt"),
  status: integer("status").notNull().default(1),
  currentRevisionId: text("current_revision_id"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
