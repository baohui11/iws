import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './org'

export const authEmailTokens = pgTable(
  'auth_email_tokens',
  {
    id: uuid().defaultRandom().primaryKey(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text().notNull(),
    tokenHash: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('idx_auth_email_tokens_user_purpose_expires').on(
      t.userId,
      t.purpose,
      t.expiresAt
    ),
    index('idx_auth_email_tokens_token_hash').on(t.tokenHash),
  ]
)
