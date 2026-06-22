import { WEEKLY_PROJECT_WEEKS_PAGE_SIZE } from '@/constants/weekly-reports-list'
import { loadWeeklyReportItemsForReportIds } from '@/lib/db/weekly/report-editor'
import { createClient } from '@/lib/supabase/server'
import { handleDbError } from '@/lib/db/handle-db-error'
import type {
  ProjectWeeklyWeekGroup,
  ProjectWeeklyWeeksPage,
  ProjectWeekWorkItemRow,
  ProjectWeekWorkItemsPage,
} from '@/types/weekly-reports'
import { compareWeekCode, weekCodesInclusiveRange } from '@/lib/utils/iso-week'
import {
  formatWeekRangeLine,
  formatWeekTitleZh,
  isTodayInWeekRange,
} from '@/lib/utils/week-display'
import { nextWeekRangeAfterWeekEnd } from '@/lib/utils/week-report-dates'

/**
 * 项目周报 Tab：按周聚合（仅非草稿周报 + project_week_exemptions 展开周次），分页单位为「周」。
 */
export async function getProjectWeeklyWeeksPage(
  projectId: string,
  weekOffset: number,
  weekLimit = WEEKLY_PROJECT_WEEKS_PAGE_SIZE
): Promise<ProjectWeeklyWeeksPage> {
  const supabase = await createClient()
  const off = Math.max(0, weekOffset)
  const lim = Math.min(Math.max(1, weekLimit), 50)

  const [{ data: codeRows, error: e0 }, { data: exRows, error: eEx }] =
    await Promise.all([
      supabase
        .from('weekly_reports')
        .select('week_code')
        .eq('project_id', projectId)
        .neq('status', 'draft'),
      supabase
        .from('project_week_exemptions')
        .select('start_week_code, end_week_code')
        .eq('project_id', projectId),
    ])

  if (e0) handleDbError(e0)
  if (eEx) handleDbError(eEx)

  const weekSet = new Set<string>()
  const noWorkWeekSet = new Set<string>()

  for (const r of codeRows ?? []) {
    if (r.week_code) weekSet.add(r.week_code)
  }

  for (const ex of exRows ?? []) {
    const s = ex.start_week_code?.trim()
    if (!s) continue
    const e = (ex.end_week_code?.trim() || s) as string
    if (compareWeekCode(s, e) > 0) continue
    for (const w of weekCodesInclusiveRange(s, e)) {
      noWorkWeekSet.add(w)
      weekSet.add(w)
    }
  }

  const orderedWeeks = [...weekSet].sort((a, b) => compareWeekCode(b, a))
  const totalWeeks = orderedWeeks.length
  const pageCodes = orderedWeeks.slice(off, off + lim)

  if (!pageCodes.length) {
    return { weeks: [], totalWeeks }
  }

  const { data: reports, error: e1 } = await supabase
    .from('weekly_reports')
    .select('id, user_id, week_code, status')
    .eq('project_id', projectId)
    .in('week_code', pageCodes)
    .neq('status', 'draft')

  if (e1) handleDbError(e1)
  const reportList = reports ?? []
  const reportIds = reportList.map((r) => r.id)

  const daysByReport = new Map<string, number>()
  if (reportIds.length) {
    const { data: items, error: e2 } = await supabase
      .from('weekly_report_items')
      .select('report_id, work_days, item_type')
      .in('report_id', reportIds)

    if (e2) handleDbError(e2)
    for (const it of items ?? []) {
      if (it.item_type !== 'work') continue
      const rid = it.report_id
      const d = it.work_days != null ? Number(it.work_days) : 0
      daysByReport.set(rid, (daysByReport.get(rid) ?? 0) + d)
    }
  }

  const userIds = [...new Set(reportList.map((r) => r.user_id))]
  const userName = new Map<string, string>()
  if (userIds.length) {
    const { data: users, error: e3 } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds)
    if (e3) handleDbError(e3)
    for (const u of users ?? []) {
      userName.set(u.id, u.name?.trim() || '—')
    }
  }

  const { data: weekMetaRows, error: e4 } = await supabase
    .from('weeks')
    .select('week_code, start_date, end_date')
    .in('week_code', pageCodes)
  if (e4) handleDbError(e4)
  const metaBy = new Map(
    (weekMetaRows ?? []).map((w) => [
      w.week_code,
      {
        start: w.start_date ?? null,
        end: w.end_date ?? null,
      },
    ])
  )

  const byWeek = new Map<string, typeof reportList>()
  for (const r of reportList) {
    const k = r.week_code
    if (!byWeek.has(k)) byWeek.set(k, [])
    byWeek.get(k)!.push(r)
  }

  const weeks: ProjectWeeklyWeekGroup[] = pageCodes.map((weekCode) => {
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
          user_id: r.user_id,
          user_name: userName.get(r.user_id) ?? '—',
          work_days: Math.round(td * 10) / 10,
          status: r.status,
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

  return { weeks, totalWeeks }
}

/**
 * 项目下单个周次：与 Tab 同一套「周次是否在索引内」判断；数据为该项目该周所有人「本周工作」事项扁平列表。
 * 若该周不在本项目周报/无工作周范围内则返回 null。
 */
export async function getProjectWeekWorkItemsPage(
  projectId: string,
  weekCode: string
): Promise<ProjectWeekWorkItemsPage | null> {
  const supabase = await createClient()

  const [{ data: codeRows, error: e0 }, { data: exRows, error: eEx }] =
    await Promise.all([
      supabase
        .from('weekly_reports')
        .select('week_code')
        .eq('project_id', projectId)
        .neq('status', 'draft'),
      supabase
        .from('project_week_exemptions')
        .select('start_week_code, end_week_code')
        .eq('project_id', projectId),
    ])

  if (e0) handleDbError(e0)
  if (eEx) handleDbError(eEx)

  const weekSet = new Set<string>()
  const noWorkWeekSet = new Set<string>()

  for (const r of codeRows ?? []) {
    if (r.week_code) weekSet.add(r.week_code)
  }

  for (const ex of exRows ?? []) {
    const s = ex.start_week_code?.trim()
    if (!s) continue
    const e = (ex.end_week_code?.trim() || s) as string
    if (compareWeekCode(s, e) > 0) continue
    for (const w of weekCodesInclusiveRange(s, e)) {
      noWorkWeekSet.add(w)
      weekSet.add(w)
    }
  }

  if (!weekSet.has(weekCode)) return null

  const { data: reports, error: e1 } = await supabase
    .from('weekly_reports')
    .select('id, user_id, week_code, status')
    .eq('project_id', projectId)
    .eq('week_code', weekCode)
    .neq('status', 'draft')

  if (e1) handleDbError(e1)
  const reportList = reports ?? []
  const reportIds = reportList.map((r) => r.id)

  const userIds = [...new Set(reportList.map((r) => r.user_id))]
  const userName = new Map<string, string>()
  if (userIds.length) {
    const { data: users, error: e3 } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds)
    if (e3) handleDbError(e3)
    for (const u of users ?? []) {
      userName.set(u.id, u.name?.trim() || '—')
    }
  }

  const itemsByReport = await loadWeeklyReportItemsForReportIds(reportIds)

  const workItems: ProjectWeekWorkItemRow[] = []
  const planItems: ProjectWeekWorkItemRow[] = []
  for (const r of reportList) {
    const items = itemsByReport.get(r.id) ?? []
    const name = userName.get(r.user_id) ?? '—'
    for (const it of items) {
      if (it.item_type === 'work') {
        workItems.push({
          report_id: r.id,
          author_id: r.user_id,
          author_name: name,
          item: it,
        })
      } else if (it.item_type === 'plan') {
        planItems.push({
          report_id: r.id,
          author_id: r.user_id,
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

  const { data: weekMetaRow, error: e4 } = await supabase
    .from('weeks')
    .select('week_code, start_date, end_date')
    .eq('week_code', weekCode)
    .maybeSingle()

  if (e4) handleDbError(e4)
  const start = weekMetaRow?.start_date ?? null
  const end = weekMetaRow?.end_date ?? null
  const rangeLine = formatWeekRangeLine(start, end)

  let next_plan_range_line: string | null = null
  if (end?.trim()) {
    const nw = nextWeekRangeAfterWeekEnd(end.trim())
    next_plan_range_line =
      formatWeekRangeLine(nw.start_date, nw.end_date) || null
  }

  const { data: proj, error: e5 } = await supabase
    .from('projects')
    .select('project_name')
    .eq('id', projectId)
    .maybeSingle()

  if (e5) handleDbError(e5)

  return {
    projectName: proj?.project_name ?? null,
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
