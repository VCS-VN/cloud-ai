import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    providerUid: text("provider_uid").notNull(),
    password: text("password"),
    apiKey: text("api_key"),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull(),
    displayName: text("display_name"),
    photoUrl: text("photo_url"),
    provider: text("provider").notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    lastLoginAt: timestamp("last_login_at"),
  },
  (table) => ({
    providerUidIdx: uniqueIndex("users_provider_uid_idx").on(table.providerUid),
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
);
