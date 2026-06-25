import { pgTable, uuid, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { users } from './org'

export const notifications = pgTable('notifications', {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text().notNull(),
  title: text().notNull(),
  content: text(),
  meta: jsonb().default({}).notNull(),
  isRead: boolean().default(false).notNull(),
  senderId: uuid().references(() => users.id, { onDelete: 'set null' }),
})
