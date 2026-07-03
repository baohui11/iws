import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import {
  departments,
  projectMembers,
  projectWeekExemptions,
  projects,
  weeklyReports,
} from '@/core/db/schema'
import { BusinessError } from '@/core/errors'
import {
  compareWeekCode,
  formatWeekCodeLabelZh,
  parseWeekCode,
  weekCodesInclusiveRange,
} from '@/modules/weekly/lib/iso-week'
import { mapProjectRowWithDepartment } from '../reports/repo'
import type { MemberProjectOption, ProjectWeekExemptionListRow } from '../types'

async function fetchPmProjectIds(userId: string): Promise<string[]> {
  const db = getDb()
  const rows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.projectRole, 'pm'),
        eq(projectMembers.isActive, true),
        isNull(projectMembers.deletedAt)
      )
    )
  const ids = rows
    .map((r) => r.projectId)
    .filter((id): id is string => id != null)
  return [...new Set(ids)]
}

export async function isUserPmForProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const ids = await fetchPmProjectIds(userId)
  return ids.includes(projectId)
}

function expandExemptionRowWeeks(start: string, end: string | null): string[] {
  const s = start.trim()
  const e = (end?.trim() || s) as string
  if (compareWeekCode(s, e) > 0) return []
  return weekCodesInclusiveRange(s, e)
}

export async function isProjectWeekExempt(
  projectId: string,
  weekCode: string
): Promise<boolean> {
  const w = weekCode.trim()
  if (!w) return false

  const db = getDb()
  const rows = await db
    .select({
      startWeekCode: projectWeekExemptions.startWeekCode,
      endWeekCode: projectWeekExemptions.endWeekCode,
    })
    .from(projectWeekExemptions)
    .where(eq(projectWeekExemptions.projectId, projectId))

  for (const row of rows) {
    const start = row.startWeekCode?.trim() ?? ''
    const end = (row.endWeekCode?.trim() || start) as string
    if (!start) continue
    if (compareWeekCode(w, start) >= 0 && compareWeekCode(w, end) <= 0) {
      return true
    }
  }
  return false
}

function rangesOverlapWeeks(
  aStart: string,
  aEnd: string | null,
  bWeeks: Set<string>
): boolean {
  const aWeeks = new Set(expandExemptionRowWeeks(aStart, aEnd))
  for (const w of bWeeks) {
    if (aWeeks.has(w)) return true
  }
  return false
}

export async function findProjectWeeksWithExistingReports(
  projectId: string,
  weekCodes: string[]
): Promise<string[]> {
  if (!weekCodes.length) return []
  const db = getDb()
  const rows = await db
    .select({ weekCode: weeklyReports.weekCode })
    .from(weeklyReports)
    .where(
      and(
        eq(weeklyReports.projectId, projectId),
        inArray(weeklyReports.weekCode, weekCodes),
        ne(weeklyReports.status, 'draft')
      )
    )
  const set = new Set(rows.map((r) => r.weekCode))
  return [...set].sort((a, b) => compareWeekCode(a, b))
}

export async function listPmProjectWeekExemptions(
  userId: string
): Promise<ProjectWeekExemptionListRow[]> {
  const pmIds = await fetchPmProjectIds(userId)
  if (!pmIds.length) return []

  const db = getDb()
  const rows = await db
    .select({
      id: projectWeekExemptions.id,
      projectId: projectWeekExemptions.projectId,
      startWeekCode: projectWeekExemptions.startWeekCode,
      endWeekCode: projectWeekExemptions.endWeekCode,
      createdAt: projectWeekExemptions.createdAt,
      createdBy: projectWeekExemptions.createdBy,
    })
    .from(projectWeekExemptions)
    .where(inArray(projectWeekExemptions.projectId, pmIds))
    .orderBy(desc(projectWeekExemptions.createdAt))

  if (!rows.length) return []

  const projIds = [...new Set(rows.map((r) => r.projectId))]
  const projRows = await db
    .select({ id: projects.id, projectName: projects.projectName })
    .from(projects)
    .where(inArray(projects.id, projIds))
  const nameBy = new Map(projRows.map((p) => [p.id, p.projectName]))

  return rows.map((r) => ({
    id: r.id,
    project_id: r.projectId,
    project_name: nameBy.get(r.projectId) ?? null,
    start_week_code: r.startWeekCode,
    end_week_code: r.endWeekCode,
    created_at: r.createdAt.toISOString(),
    created_by: r.createdBy,
  }))
}

export interface InsertPmProjectWeekExemptionInput {
  userId: string
  projectId: string
  weekCode: string
}

export async function insertPmProjectWeekExemption(
  input: InsertPmProjectWeekExemptionInput
): Promise<void> {
  const { userId, projectId } = input
  const week = input.weekCode.trim()

  if (!week || !parseWeekCode(week)) {
    throw new BusinessError('请选择有效的周次')
  }

  const pmOk = await isUserPmForProject(userId, projectId)
  if (!pmOk) {
    throw new BusinessError('您不是该项目的项目经理，无法设置无工作')
  }

  const newWeeks = weekCodesInclusiveRange(week, week)
  if (!newWeeks.length) {
    throw new BusinessError('周次无效')
  }

  const conflicting = await findProjectWeeksWithExistingReports(
    projectId,
    newWeeks
  )
  if (conflicting.length) {
    const labels = conflicting.map(formatWeekCodeLabelZh).join('、')
    throw new BusinessError(
      `以下周次已有成员提交周报，无法设置无工作：${labels}`
    )
  }

  const newWeekSet = new Set(newWeeks)
  const db = getDb()
  const existing = await db
    .select({
      id: projectWeekExemptions.id,
      startWeekCode: projectWeekExemptions.startWeekCode,
      endWeekCode: projectWeekExemptions.endWeekCode,
    })
    .from(projectWeekExemptions)
    .where(eq(projectWeekExemptions.projectId, projectId))

  for (const ex of existing) {
    if (
      rangesOverlapWeeks(ex.startWeekCode, ex.endWeekCode, newWeekSet)
    ) {
      throw new BusinessError(
        '所选周次与已有无工作记录重叠，请先删除或调整已有记录'
      )
    }
  }

  await db.insert(projectWeekExemptions).values({
    projectId,
    startWeekCode: week,
    endWeekCode: week,
    createdBy: userId,
  })
}

export async function deletePmProjectWeekExemption(
  userId: string,
  exemptionId: string
): Promise<void> {
  const pmIds = await fetchPmProjectIds(userId)
  if (!pmIds.length) {
    throw new BusinessError('无权操作')
  }

  const db = getDb()
  const rows = await db
    .select({
      id: projectWeekExemptions.id,
      projectId: projectWeekExemptions.projectId,
    })
    .from(projectWeekExemptions)
    .where(eq(projectWeekExemptions.id, exemptionId))
    .limit(1)

  const row = rows[0]
  if (!row || !pmIds.includes(row.projectId)) {
    throw new BusinessError('记录不存在或无权删除')
  }

  await db
    .delete(projectWeekExemptions)
    .where(eq(projectWeekExemptions.id, exemptionId))
}

export async function getPmProjectsForExemptions(
  userId: string
): Promise<MemberProjectOption[]> {
  const projectIds = await fetchPmProjectIds(userId)
  if (!projectIds.length) return []

  const db = getDb()
  const rows = await db
    .select({
      id: projects.id,
      projectNo: projects.projectNo,
      projectName: projects.projectName,
      departmentId: projects.departmentId,
      departmentName: departments.name,
    })
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .where(
      and(
        inArray(projects.id, projectIds),
        isNull(projects.deletedAt),
        eq(projects.isActive, true)
      )
    )
    .orderBy(projects.projectNo)

  return rows.map(mapProjectRowWithDepartment)
}
