import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const projectMessages = pgTable('project_messages', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  userId: text('user_id'),
  role: text('role').notNull(),
  content: text('content').notNull(),
  status: integer('status').notNull().default(1),
  processingStatus: text('processing_status').notNull().default('completed'),
  createdAt: timestamp('created_at').notNull()
})
