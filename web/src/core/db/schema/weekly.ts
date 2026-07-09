import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  boolean,
  jsonb,
  numeric,
  date,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import {
  weeklyReportAction,
  weeklyReportItemType,
  weeklyReportStatus,
  projectStage,
} from './enums'
import { users } from './org'
import { projects } from './projects'
import { files } from './files'

export const weeks = pgTable(
  'weeks',
  {
    id: uuid().defaultRandom().primaryKey(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    year: integer().notNull(),
    weekNo: integer().notNull(),
    weekCode: text().notNull(),
    startDate: date().notNull(),
    endDate: date().notNull(),
    deadline: timestamp({ withTimezone: true }),
    isLocked: boolean().default(false).notNull(),
  },
  (t) => [unique().on(t.year, t.weekNo)]
)

export const weeklyReports = pgTable(
  'weekly_reports',
  {
    id: uuid().defaultRandom().primaryKey(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    weekCode: text().notNull(),
    projectStage: projectStage().default('实施阶段').notNull(),
    status: weeklyReportStatus().default('draft').notNull(),
    submitTime: timestamp({ withTimezone: true }),
    isOverdue: boolean().default(false).notNull(),
  },
  (t) => [unique().on(t.userId, t.projectId, t.weekCode, t.projectStage)]
)

export const weeklyReportItems = pgTable('weekly_report_items', {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  reportId: uuid()
    .notNull()
    .references(() => weeklyReports.id, { onDelete: 'cascade' }),
  itemType: weeklyReportItemType().default('work').notNull(),
  itemDesc: text(),
  workDays: numeric({ precision: 4, scale: 1 }),
  workDates: jsonb(),
  sortOrder: smallint().default(0),
})

export const weeklyReportApprovals = pgTable('weekly_report_approvals', {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  reportId: uuid().notNull(),
  approverId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  action: weeklyReportAction().notNull(),
  rejectReason: text(),
  approvedAt: timestamp({ withTimezone: true }),
  isOverdue: boolean().default(false).notNull(),
})

export const weeklyReportFileLinks = pgTable(
  'weekly_report_file_links',
  {
    id: uuid().defaultRandom().primaryKey(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    reportItemId: uuid().notNull(),
    fileId: uuid()
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
  },
  (t) => [unique().on(t.reportItemId, t.fileId)]
)
