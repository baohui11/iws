import {
  pgTable,
  uuid,
  text,
  varchar,
  smallint,
  boolean,
  index,
  timestamp,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { dataScopeType, systemRoles } from './enums'

export const departments = pgTable('departments', {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  name: text().notNull(),
  code: text().notNull().unique(),
  parentId: uuid().references((): AnyPgColumn => departments.id, {
    onDelete: 'cascade',
  }),
  level: smallint(),
  isActive: boolean().default(false).notNull(),
  deletedAt: timestamp({ withTimezone: true }),
})

export const users = pgTable('users', {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  passwordHash: text(),
  name: text(),
  employeeNo: text().unique(),
  email: varchar().unique(),
  gender: text(),
  position: text(),
  departmentId: uuid().references(() => departments.id, {
    onDelete: 'set null',
  }),
  avatarUrl: text(),
  isActive: boolean().default(false).notNull(),
  isDeptLeader: boolean().default(false).notNull(),
  deletedAt: timestamp({ withTimezone: true }),
  role: systemRoles().default('user'),
  tags: text(),
  inviteSentAt: timestamp({ withTimezone: true }),
})

export const userDataScopes = pgTable(
  'user_data_scopes',
  {
    id: uuid().defaultRandom().primaryKey(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp({ withTimezone: true }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scopeType: dataScopeType().notNull(),
    departmentId: uuid().references(() => departments.id, {
      onDelete: 'cascade',
    }),
    includeChildren: boolean().default(true).notNull(),
  },
  (t) => [
    index('idx_user_data_scopes_user').on(t.userId),
    index('idx_user_data_scopes_department').on(t.departmentId),
  ]
)
