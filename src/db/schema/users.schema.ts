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
    firebaseUid: text("firebase_uid").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull(),
    displayName: text("display_name"),
    photoUrl: text("photo_url"),
    authProvider: text("auth_provider").notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    lastLoginAt: timestamp("last_login_at"),
  },
  (table) => ({
    firebaseUidIdx: uniqueIndex("users_firebase_uid_idx").on(table.firebaseUid),
    emailIdx: index("users_email_idx").on(table.email),
  }),
);
