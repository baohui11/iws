import { and, eq, inArray, ne } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import {
  projects,
  projectWeekExemptions,
  users,
  weeklyReportItems,
  weeklyReports,
  weeks,
} from '@/core/db/schema'
import { WEEKLY_PROJECT_WEEKS_PAGE_SIZE } from '@/constants/weekly-reports-list'
import { compareWeekCode, weekCodesInclusiveRange } from '@/modules/weekly/lib/iso-week'
import {
  formatWeekRangeLine,
  formatWeekTitleZh,
  isTodayInWeekRange,
} from '@/modules/weekly/lib/week-display'
import { nextWeekRangeAfterWeekEnd } from '@/modules/weekly/lib/week-report-dates'
import { loadWeeklyReportItemsForReportIds } from '../report-editor/repo'
import type {
  ProjectWeeklyReporterRow,
  ProjectWeeklyWeekGroup,
  ProjectWeeklyWeeksPage,
  ProjectWeekWorkItemRow,
  ProjectWeekWorkItemsPage,
} from '../types'

async function fetchProjectWeekIndex(projectId: string) {
  const db = getDb()

  const [codeRows, exRows] = await Promise.all([
    db
      .select({ weekCode: weeklyReports.weekCode })
      .from(weeklyReports)
      .where(
        and(
          eq(weeklyReports.projectId, projectId),
          ne(weeklyReports.status, 'draft')
        )
      ),
    db
      .select({
        startWeekCode: projectWeekExemptions.startWeekCode,
        endWeekCode: projectWeekExemptions.endWeekCode,
      })
      .from(projectWeekExemptions)
      .where(eq(projectWeekExemptions.projectId, projectId)),
  ])

  const weekSet = new Set<string>()
  const noWorkWeekSet = new Set<string>()

  for (const r of codeRows) {
    if (r.weekCode) weekSet.add(r.weekCode)
  }

  for (const ex of exRows) {
    const s = ex.startWeekCode?.trim()
    if (!s) continue
    const e = (ex.endWeekCode?.trim() || s) as string
    if (compareWeekCode(s, e) > 0) continue
    for (const w of weekCodesInclusiveRange(s, e)) {
      noWorkWeekSet.add(w)
      weekSet.add(w)
    }
  }

  const orderedWeeks = [...weekSet].sort((a, b) => compareWeekCode(b, a))
  return { weekSet, noWorkWeekSet, orderedWeeks }
}

/**
 * 项目周报 Tab：按周聚合（仅非草稿周报 + project_week_exemptions 展开周次），分页单位为「周」。
 */
export async function getProjectWeeklyWeeksPage(
  projectId: string,
  weekOffset: number,
  weekLimit = WEEKLY_PROJECT_WEEKS_PAGE_SIZE
): Promise<ProjectWeeklyWeeksPage> {
  const off = Math.max(0, weekOffset)
  const lim = Math.min(Math.max(1, weekLimit), 50)

  const { noWorkWeekSet, orderedWeeks } =
    await fetchProjectWeekIndex(projectId)

  const totalWeeks = orderedWeeks.length
  const pageCodes = orderedWeeks.slice(off, off + lim)

  if (!pageCodes.length) {
    return { weeks: [], totalWeeks }
  }

  const db = getDb()
  const reportList = await db
    .select({
      id: weeklyReports.id,
      userId: weeklyReports.userId,
      weekCode: weeklyReports.weekCode,
      status: weeklyReports.status,
    })
    .from(weeklyReports)
    .where(
      and(
        eq(weeklyReports.projectId, projectId),
        inArray(weeklyReports.weekCode, pageCodes),
        ne(weeklyReports.status, 'draft')
      )
    )

  const reportIds = reportList.map((r) => r.id)

  const daysByReport = new Map<string, number>()
  if (reportIds.length) {
    const items = await db
      .select({
        reportId: weeklyReportItems.reportId,
        workDays: weeklyReportItems.workDays,
        itemType: weeklyReportItems.itemType,
      })
      .from(weeklyReportItems)
      .where(inArray(weeklyReportItems.reportId, reportIds))

    for (const it of items) {
      if (it.itemType !== 'work') continue
      const rid = it.reportId
      const d = it.workDays != null ? Number(it.workDays) : 0
      daysByReport.set(rid, (daysByReport.get(rid) ?? 0) + d)
    }
  }

  const userIds = [...new Set(reportList.map((r) => r.userId))]
  const userName = new Map<string, string>()
  if (userIds.length) {
    const userRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, userIds))
    for (const u of userRows) {
      userName.set(u.id, u.name?.trim() || '—')
    }
  }

  const weekMetaRows = await db
    .select({
      weekCode: weeks.weekCode,
      startDate: weeks.startDate,
      endDate: weeks.endDate,
    })
    .from(weeks)
    .where(inArray(weeks.weekCode, pageCodes))

  const metaBy = new Map(
    weekMetaRows.map((w) => [
      w.weekCode,
      {
        start: w.startDate ?? null,
        end: w.endDate ?? null,
      },
    ])
  )

  const byWeek = new Map<string, typeof reportList>()
  for (const r of reportList) {
    const k = r.weekCode
    if (!byWeek.has(k)) byWeek.set(k, [])
    byWeek.get(k)!.push(r)
  }

  const weeksOut: ProjectWeeklyWeekGroup[] = pageCodes.map((weekCode) => {
    const list = byWeek.get(weekCode) ?? []
    const meta = metaBy.get(weekCode)
    const start = meta?.start ?? null
    const end = meta?.end ?? null
    const rangeLine = formatWeekRangeLine(start, end)

    const reporters = list
      .map((r) => {
        const td = daysByReport.get(r.id) ?? 0
        return {
          report_id: r.id,
          user_id: r.userId,
          user_name: userName.get(r.userId) ?? '—',
          work_days: Math.round(td * 10) / 10,
          status: r.status as ProjectWeeklyReporterRow['status'],
        }
      })
      .sort((a, b) =>
        a.user_name.localeCompare(b.user_name, 'zh-CN', { sensitivity: 'base' })
      )

    const total_work_days =
      Math.round(reporters.reduce((s, x) => s + x.work_days, 0) * 10) / 10

    return {
      week_code: weekCode,
      title_zh: formatWeekTitleZh(weekCode),
      range_line: rangeLine,
      is_current: isTodayInWeekRange(start, end),
      is_no_work_week: noWorkWeekSet.has(weekCode),
      total_work_days,
      reporters,
    }
  })

  return { weeks: weeksOut, totalWeeks }
}

/**
 * 项目下单个周次：与 Tab 同一套「周次是否在索引内」判断；数据为该项目该周所有人「本周工作」事项扁平列表。
 * 若该周不在本项目周报/无工作周范围内则返回 null。
 */
export async function getProjectWeekWorkItemsPage(
  projectId: string,
  weekCode: string
): Promise<ProjectWeekWorkItemsPage | null> {
  const { weekSet, noWorkWeekSet } = await fetchProjectWeekIndex(projectId)

  if (!weekSet.has(weekCode)) return null

  const db = getDb()
  const reportList = await db
    .select({
      id: weeklyReports.id,
      userId: weeklyReports.userId,
      weekCode: weeklyReports.weekCode,
      status: weeklyReports.status,
    })
    .from(weeklyReports)
    .where(
      and(
        eq(weeklyReports.projectId, projectId),
        eq(weeklyReports.weekCode, weekCode),
        ne(weeklyReports.status, 'draft')
      )
    )

  const reportIds = reportList.map((r) => r.id)

  const userIds = [...new Set(reportList.map((r) => r.userId))]
  const userName = new Map<string, string>()
  if (userIds.length) {
    const userRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, userIds))
    for (const u of userRows) {
      userName.set(u.id, u.name?.trim() || '—')
    }
  }

  const itemsByReport = await loadWeeklyReportItemsForReportIds(reportIds)

  const workItems: ProjectWeekWorkItemRow[] = []
  const planItems: ProjectWeekWorkItemRow[] = []
  for (const r of reportList) {
    const items = itemsByReport.get(r.id) ?? []
    const name = userName.get(r.userId) ?? '—'
    for (const it of items) {
      if (it.item_type === 'work') {
        workItems.push({
          report_id: r.id,
          author_id: r.userId,
          author_name: name,
          item: it,
        })
      } else if (it.item_type === 'plan') {
        planItems.push({
          report_id: r.id,
          author_id: r.userId,
          author_name: name,
          item: it,
        })
      }
    }
  }

  const sortByAuthorThenOrder = (
    a: ProjectWeekWorkItemRow,
    b: ProjectWeekWorkItemRow
  ) => {
    const cmp = a.author_name.localeCompare(b.author_name, 'zh-CN', {
      sensitivity: 'base',
    })
    if (cmp !== 0) return cmp
    return a.item.sort_order - b.item.sort_order
  }
  workItems.sort(sortByAuthorThenOrder)
  planItems.sort(sortByAuthorThenOrder)

  const weekMetaRows = await db
    .select({
      weekCode: weeks.weekCode,
      startDate: weeks.startDate,
      endDate: weeks.endDate,
    })
    .from(weeks)
    .where(eq(weeks.weekCode, weekCode))
    .limit(1)

  const weekMetaRow = weekMetaRows[0]
  const start = weekMetaRow?.startDate ?? null
  const end = weekMetaRow?.endDate ?? null
  const rangeLine = formatWeekRangeLine(start, end)

  let next_plan_range_line: string | null = null
  if (end?.trim()) {
    const nw = nextWeekRangeAfterWeekEnd(end.trim())
    next_plan_range_line =
      formatWeekRangeLine(nw.start_date, nw.end_date) || null
  }

  const projRows = await db
    .select({ projectName: projects.projectName })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  return {
    projectName: projRows[0]?.projectName ?? null,
    week_code: weekCode,
    title_zh: formatWeekTitleZh(weekCode),
    range_line: rangeLine,
    is_current: isTodayInWeekRange(start, end),
    is_no_work_week: noWorkWeekSet.has(weekCode),
    workItems,
    planItems,
    next_plan_range_line,
  }
}
