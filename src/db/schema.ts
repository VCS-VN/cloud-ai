import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const storefrontProjects = pgTable('storefront_projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  currentRevisionId: text('current_revision_id'),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull()
})

export const projectRevisions = pgTable('project_revisions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').notNull()
})

export const generationRecords = pgTable('generation_records', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  revisionId: text('revision_id'),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').notNull()
})

export const previewTokens = pgTable('preview_tokens', {
  token: text('token').primaryKey(),
  projectId: text('project_id').notNull(),
  revisionId: text('revision_id').notNull(),
  createdAt: timestamp('created_at').notNull()
})

export const projectMessages = pgTable('project_messages', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').notNull()
})

export const projectFileNodes = pgTable('project_file_nodes', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
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
