import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const userSettings = pgTable(
  "user_settings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    episCloudApiKey: text("epis_cloud_api_key"),
    episCloudApiKeyId: text("epis_cloud_api_key_id"),
    episCloudApiKeyPrefix: text("epis_cloud_api_key_prefix"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("user_settings_user_id_idx").on(table.userId),
  }),
);
