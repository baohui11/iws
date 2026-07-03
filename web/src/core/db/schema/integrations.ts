import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const oaSyncRuns = pgTable(
  'oa_sync_runs',
  {
    id: uuid().defaultRandom().primaryKey(),
    scope: text().notNull(),
    trigger: text().notNull(),
    status: text().notNull(),
    pulledCount: integer().default(0).notNull(),
    createdCount: integer().default(0).notNull(),
    updatedCount: integer().default(0).notNull(),
    unchangedCount: integer().default(0).notNull(),
    deletedCount: integer().default(0).notNull(),
    warningCount: integer().default(0).notNull(),
    warnings: jsonb(),
    errorMessage: text(),
    startedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_oa_sync_runs_scope_started').on(t.scope, t.startedAt),
    index('idx_oa_sync_runs_status_started').on(t.status, t.startedAt),
  ]
)
