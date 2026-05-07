import { integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const agentMessageChunks = pgTable(
  'agent_message_chunks',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    messageId: text('message_id').notNull(),
    userId: text('user_id'),
    sequence: integer('sequence').notNull(),
    content: text('content').notNull(),
    providerEventType: text('provider_event_type'),
    createdAt: timestamp('created_at').notNull()
  },
  (table) => ({
    messageSequenceIdx: uniqueIndex('agent_message_chunks_message_sequence_idx').on(table.messageId, table.sequence)
  })
)
