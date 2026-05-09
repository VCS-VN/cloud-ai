import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const projectStates = pgTable(
  "project_states",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    userId: text("user_id"),
    status: text("status").notNull(),
    stack: jsonb("stack").notNull(),
    packagePolicy: jsonb("package_policy").notNull(),
    ecommerceSpec: jsonb("ecommerce_spec").notNull(),
    brand: jsonb("brand").notNull(),
    pages: jsonb("pages").notNull(),
    features: jsonb("features").notNull(),
    constraints: jsonb("constraints").notNull(),
    fileManifest: jsonb("file_manifest").notNull(),
    decisionLog: jsonb("decision_log").notNull(),
    recentChanges: jsonb("recent_changes").notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => ({
    projectIdx: uniqueIndex("project_states_project_idx").on(table.projectId),
    userIdx: index("project_states_user_idx").on(table.userId),
  }),
);
