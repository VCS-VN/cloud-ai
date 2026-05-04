import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const previewTokens = pgTable('preview_tokens', {
  token: text('token').primaryKey(),
  projectId: text('project_id').notNull(),
  revisionId: text('revision_id').notNull(),
  createdAt: timestamp('created_at').notNull()
})
