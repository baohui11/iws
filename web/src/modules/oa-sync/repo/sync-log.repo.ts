import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { oaSyncRuns } from '@/core/db/schema'
import type { OaSyncScope, OaSyncStatus, OaSyncTrigger } from '../types'

export interface OaSyncRunRow {
  id: string
  scope: OaSyncScope
  trigger: OaSyncTrigger
  status: OaSyncStatus
  pulledCount: number
  createdCount: number
  updatedCount: number
  unchangedCount: number
  deletedCount: number
  warningCount: number
  warnings: unknown
  errorMessage: string | null
  startedAt: Date
  finishedAt: Date | null
  createdAt: Date
}

export async function createOaSyncRun(input: {
  scope: OaSyncScope
  trigger: OaSyncTrigger
}): Promise<string> {
  const db = getDb()
  const rows = await db
    .insert(oaSyncRuns)
    .values({
      scope: input.scope,
      trigger: input.trigger,
      status: 'running',
      startedAt: new Date(),
    })
    .returning({ id: oaSyncRuns.id })
  return rows[0].id
}

export async function completeOaSyncRun(
  id: string,
  input: {
    pulledCount: number
    createdCount: number
    updatedCount: number
    unchangedCount: number
    deletedCount: number
    warningCount: number
    warnings?: unknown
  }
): Promise<void> {
  const db = getDb()
  await db
    .update(oaSyncRuns)
    .set({
      status: 'succeeded',
      pulledCount: input.pulledCount,
      createdCount: input.createdCount,
      updatedCount: input.updatedCount,
      unchangedCount: input.unchangedCount,
      deletedCount: input.deletedCount,
      warningCount: input.warningCount,
      warnings: input.warnings,
      finishedAt: new Date(),
    })
    .where(eq(oaSyncRuns.id, id))
}

export async function failOaSyncRun(id: string, error: unknown): Promise<void> {
  const db = getDb()
  await db
    .update(oaSyncRuns)
    .set({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      finishedAt: new Date(),
    })
    .where(eq(oaSyncRuns.id, id))
}

export async function listOaSyncRuns(limit = 20): Promise<OaSyncRunRow[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(oaSyncRuns)
    .orderBy(desc(oaSyncRuns.startedAt))
    .limit(Math.max(1, Math.min(100, Math.trunc(limit))))

  return rows.map((row) => ({
    id: row.id,
    scope: row.scope as OaSyncScope,
    trigger: row.trigger as OaSyncTrigger,
    status: row.status as OaSyncStatus,
    pulledCount: row.pulledCount,
    createdCount: row.createdCount,
    updatedCount: row.updatedCount,
    unchangedCount: row.unchangedCount,
    deletedCount: row.deletedCount,
    warningCount: row.warningCount,
    warnings: row.warnings,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
  }))
}
