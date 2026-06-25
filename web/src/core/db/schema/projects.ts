import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { projectRoles, projectStage, projectStatus } from './enums'
import { departments, users } from './org'

export const projects = pgTable('projects', {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp({ withTimezone: true }),
  projectNo: text(),
  projectName: text(),
  projectStatus: projectStatus().default('preparing'),
  projectStage: projectStage().default('实施阶段').notNull(),
  departmentId: uuid().references(() => departments.id),
  startDate: text(),
  endDate: text(),
  industryCategory: text(),
  customerName: text(),
  businessType: text(),
  productBlock: text(),
  projectIntroduction: text(),
  contractNo: text().unique(),
  fiscalYear: text(),
})

export const projectMembers = pgTable('project_members', {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp({ withTimezone: true }),
  projectId: uuid().references(() => projects.id),
  userId: uuid().references(() => users.id),
  projectRole: projectRoles().default('member'),
})

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
