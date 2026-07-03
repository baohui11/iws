import { boolean, index, pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { projectStage, projectStatus } from './enums'
import { departments, users } from './org'

export const projects = pgTable(
  'projects',
  {
    id: uuid().defaultRandom().primaryKey(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp({ withTimezone: true }),
    projectNo: text(),
    projectName: text(),
    projectStatus: projectStatus().default('进行中'),
    projectStage: projectStage().default('实施阶段').notNull(),
    departmentId: uuid().references(() => departments.id),
    startDate: text(),
    endDate: text(),
    projectType: text(),
    contractNo: text(),
    fiscalYear: text(),
    isActive: boolean().default(false).notNull(),
  },
  (t) => [index('idx_projects_project_no').on(t.projectNo)]
)

export const projectMembers = pgTable(
  'project_members',
  {
    id: uuid().defaultRandom().primaryKey(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp({ withTimezone: true }),
    projectId: uuid().references(() => projects.id),
    userId: uuid().references(() => users.id),
    projectRole: text().default('member'),
    projectStage: projectStage(),
    isActive: boolean().default(true).notNull(),
  },
  (t) => [
    index('idx_project_members_sync_key').on(
      t.projectId,
      t.userId,
      t.projectRole
    ),
  ]
)

export const contractDeliverables = pgTable('contract_deliverables', {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  projectId: uuid().references(() => projects.id),
  name: text().notNull().unique(),
  description: text(),
})

export const projectWeekExemptions = pgTable('project_week_exemptions', {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  startWeekCode: text().notNull(),
  endWeekCode: text(),
  reason: text(),
  createdBy: uuid()
    .notNull()
    .references(() => users.id),
})
