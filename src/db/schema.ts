import { jsonb, pgTable, text, timestamp, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  firebaseUid: text('firebase_uid').notNull(),
  email: text('email').notNull(),
  emailVerified: boolean('email_verified').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  authProvider: text('auth_provider').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  lastLoginAt: timestamp('last_login_at').notNull()
}, (table) => ({
  firebaseUidIdx: uniqueIndex('users_firebase_uid_idx').on(table.firebaseUid),
  emailIdx: index('users_email_idx').on(table.email)
}))

export const storefrontProjects = pgTable('storefront_projects', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  name: text('name').notNull(),
  currentRevisionId: text('current_revision_id'),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull()
})

export const projectRevisions = pgTable('project_revisions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  userId: text('user_id'),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').notNull()
})

export const generationRecords = pgTable('generation_records', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  userId: text('user_id'),
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
  userId: text('user_id'),
  role: text('role').notNull(),
  content: text('content').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').notNull()
})

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
