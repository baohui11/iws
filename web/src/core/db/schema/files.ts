import {
  pgTable,
  uuid,
  text,
  bigint,
  integer,
  boolean,
  jsonb,
  timestamp,
  unique,
  check,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import {
  filePipelineStatus,
  fileProcessStage,
  fileSourceType,
} from './enums'
import { projects, contractDeliverables } from './projects'
import { users } from './org'

export const files = pgTable(
  'files',
  {
    id: uuid().defaultRandom().primaryKey(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'restrict' }),
    fileName: text().notNull(),
    fileSize: bigint({ mode: 'number' }).notNull(),
    fileExt: text(),
    mimeType: text(),
    sourceStorageKey: text().notNull(),
    previewStorageKey: text(),
    previewStatus: filePipelineStatus().default('pending').notNull(),
    previewError: text(),
    parsedStorageKey: text(),
    parseStatus: filePipelineStatus().default('pending').notNull(),
    parseError: text(),
    indexStatus: filePipelineStatus().default('pending').notNull(),
    indexError: text(),
    processingUpdatedAt: timestamp({ withTimezone: true }),
    uploaderId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    versionGroupId: uuid().notNull(),
    versionNo: integer().default(1).notNull(),
    versionLabel: text(),
    isLatest: boolean().default(true),
    isDeliverable: boolean().default(false),
    contractDeliverableId: uuid().references(() => contractDeliverables.id, {
      onDelete: 'set null',
    }),
    fileSource: fileSourceType(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    isConfidential: boolean().default(false),
  },
  (t) => [check('chk_version_no_positive', sql`${t.versionNo} > 0`)]
)

export const fileComments = pgTable('file_comments', {
  id: uuid().defaultRandom().primaryKey(),
  fileId: uuid()
    .notNull()
    .references(() => files.id, { onDelete: 'cascade' }),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  parentId: uuid().references((): AnyPgColumn => fileComments.id, {
    onDelete: 'cascade',
  }),
  content: text().notNull(),
  isPublic: boolean().default(true),
  deletedAt: timestamp({ withTimezone: true }),
  deletedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp({ withTimezone: true }).defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow(),
})

export const fileDownloadRecord = pgTable('file_download_record', {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
  fileId: uuid().references(() => files.id, { onDelete: 'cascade' }),
  downloadedAt: timestamp({ withTimezone: true }),
  ipAddress: text(),
})

export const fileInteractions = pgTable(
  'file_interactions',
  {
    id: uuid().defaultRandom().primaryKey(),
    createdAt: timestamp({ withTimezone: true }).defaultNow(),
    fileId: uuid()
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userRoleAtTime: text(),
    /** 'favorite' 收藏 / 'recommend' 点赞 */
    interactionType: text().notNull(),
  },
  (t) => [
    unique().on(t.fileId, t.userId, t.interactionType),
    check(
      'file_interactions_interaction_type_check',
      sql`${t.interactionType} in ('favorite', 'recommend')`
    ),
  ]
)

export const fileProcessTasks = pgTable(
  'file_process_tasks',
  {
    id: uuid().defaultRandom().primaryKey(),
    fileId: uuid()
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    stage: fileProcessStage().notNull(),
    status: filePipelineStatus().default('pending').notNull(),
    attempts: integer().default(0).notNull(),
    maxAttempts: integer().default(3).notNull(),
    priority: integer().default(0).notNull(),
    runAfter: timestamp({ withTimezone: true }).defaultNow().notNull(),
    lockedBy: text(),
    lockedAt: timestamp({ withTimezone: true }),
    input: jsonb(),
    output: jsonb(),
    errorCode: text(),
    errorMsg: text(),
    startedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    pgmqMessageId: bigint({ mode: 'number' }),
  },
  (t) => [
    unique().on(t.fileId, t.stage),
    index('idx_file_process_tasks_pick').on(
      t.status,
      t.runAfter,
      t.priority,
      t.createdAt
    ),
    index('idx_file_process_tasks_file').on(t.fileId),
    check('chk_file_process_tasks_attempts', sql`${t.attempts} >= 0`),
    check('chk_file_process_tasks_max_attempts', sql`${t.maxAttempts} > 0`),
  ]
)

export const fileReferenceLinks = pgTable(
  'file_reference_links',
  {
    id: uuid().defaultRandom().primaryKey(),
    referenceFileId: uuid()
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    deliverableFileId: uuid()
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
  },
  (t) => [unique().on(t.referenceFileId, t.deliverableFileId)]
)
