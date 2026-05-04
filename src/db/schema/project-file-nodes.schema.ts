import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const projectFileNodes = pgTable('project_file_nodes', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  userId: text('user_id'),
  name: text('name').notNull(),
  type: text('type').notNull(),
  path: text('path').notNull(),
  parentId: text('parent_id'),
  contentType: text('content_type'),
  content: text('content'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull()
})
