import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const projectMessages = pgTable('project_messages', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  userId: text('user_id'),
  role: text('role').notNull(),
  content: text('content').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').notNull()
})
