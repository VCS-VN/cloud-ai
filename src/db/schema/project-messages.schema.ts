import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const projectMessages = pgTable(
  'project_messages',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    userId: text('user_id'),
    role: text('role').notNull(),
    content: text('content').notNull(),
    status: integer('status').notNull().default(1),
    processingStatus: text('processing_status').notNull().default('completed'),
    parentMessageId: text('parent_message_id'),
    runId: text('run_id'),
    kind: text('kind'),
    provider: text('provider'),
    providerResponseId: text('provider_response_id'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at')
  },
  (table) => ({
    projectRunIdx: index('project_messages_project_run_idx').on(table.projectId, table.runId)
  })
)
