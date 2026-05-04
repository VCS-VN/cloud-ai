import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const storefrontProjects = pgTable('storefront_projects', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  name: text('name').notNull(),
  currentRevisionId: text('current_revision_id'),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull()
})
