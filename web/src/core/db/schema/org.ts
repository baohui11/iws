import {
  pgTable,
  uuid,
  text,
  varchar,
  smallint,
  timestamp,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { systemRoles } from './enums'

export const departments = pgTable('departments', {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  name: text().notNull().unique(),
  code: text().notNull().unique(),
  parentId: uuid().references((): AnyPgColumn => departments.id, {
    onDelete: 'cascade',
  }),
  level: smallint(),
  deletedAt: timestamp({ withTimezone: true }),
  /** 部门负责人；逻辑指向 users.id（避免与 users.departmentId 形成建表期循环，不加 DB 外键约束） */
  leaderId: uuid(),
})

export const users = pgTable('users', {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  /** bcrypt 密码哈希（替代原 Supabase Auth） */
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
  deletedAt: timestamp({ withTimezone: true }),
  role: systemRoles().default('user'),
})
