import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const generationRecords = pgTable('generation_records', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  userId: text('user_id'),
  revisionId: text('revision_id'),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').notNull()
})
