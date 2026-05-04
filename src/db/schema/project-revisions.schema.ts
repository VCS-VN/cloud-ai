import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const projectRevisions = pgTable('project_revisions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  userId: text('user_id'),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').notNull()
})
