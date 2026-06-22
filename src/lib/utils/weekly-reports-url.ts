/** 我填写的周报：?view=&weekFrom=&weekTo=&projects=（旧 weeks= 仍可读） */
/** 我审批的周报：?approval=&weeks=&projects= */

import type { ApprovalDoneFilter, MemberProjectOption, MyFilledGroupView } from '@/types/weekly-reports'
import {
  compareWeekCode,
  getCurrentWeekCode,
  shiftWeekCode,
  weekCodesInclusiveRange,
} from '@/lib/utils/iso-week'

export type WeeklyFilledUrlState = {
  view: MyFilledGroupView
  weekFrom: string
  weekTo: string
  /** 含旧参数 weeks= 或 weekFrom/weekTo 时为 true */
  hasWeekRangeInUrl: boolean
  /** 空 = 全部项目（在本人成员项目范围内） */
  projects: string[]
  hasProjectsInUrl: boolean
}

export type WeeklyApprovalsUrlState = {
  approval: ApprovalDoneFilter
  weeks: string[]
  projects: string[]
  hasWeeksInUrl: boolean
}

function firstString(v: string | string[] | undefined): string {
  if (v == null) return ''
  return typeof v === 'string' ? v : v[0] ?? ''
}

function parseCsv(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

/** 默认选中：上一周 + 当前周（均在可选列表中存在时）— 用于「我的审批」等旧逻辑 */
export function getDefaultWeekFilterCodes(
  weekOptions: { week_code: string }[]
): string[] {
  const set = new Set(weekOptions.map((w) => w.week_code))
  const cur = getCurrentWeekCode()
  const prev = shiftWeekCode(cur, -1)
  const out: string[] = []
  if (prev && set.has(prev)) out.push(prev)
  if (set.has(cur)) out.push(cur)
  if (out.length > 0) return out
  return weekOptions.slice(0, 2).map((w) => w.week_code)
}

/** 「我的周报」默认：起始周 = 当前周往前 2 周，截止周 = 本周 */
export function getDefaultMyReportsWeekRange(
  weekOptions: { week_code: string }[]
): { weekFrom: string; weekTo: string } {
  const set = new Set(weekOptions.map((w) => w.week_code))
  const cur = getCurrentWeekCode()
  const end = set.has(cur) ? cur : (weekOptions[0]?.week_code ?? cur)
  const cand2 = shiftWeekCode(end, -2)
  const cand1 = shiftWeekCode(end, -1)
  const start =
    cand2 && set.has(cand2)
      ? cand2
      : cand1 && set.has(cand1)
        ? cand1
        : end

  let weekFrom = start
  let weekTo = end
  if (compareWeekCode(weekFrom, weekTo) > 0) {
    const t = weekFrom
    weekFrom = weekTo
    weekTo = t
  }
  return { weekFrom, weekTo }
}

export function resolveMyReportsWeekCodes(
  weekOptions: { week_code: string }[],
  state: Pick<WeeklyFilledUrlState, 'hasWeekRangeInUrl' | 'weekFrom' | 'weekTo'>
): string[] {
  const optionSet = new Set(weekOptions.map((w) => w.week_code))
  const defaults = getDefaultMyReportsWeekRange(weekOptions)

  let from = state.hasWeekRangeInUrl
    ? state.weekFrom?.trim() || defaults.weekFrom
    : defaults.weekFrom
  let to = state.hasWeekRangeInUrl
    ? state.weekTo?.trim() || defaults.weekTo
    : defaults.weekTo

  if (from && !optionSet.has(from)) from = defaults.weekFrom
  if (to && !optionSet.has(to)) to = defaults.weekTo
  if (!from || !to) return []

  if (compareWeekCode(from, to) > 0) {
    const t = from
    from = to
    to = t
  }

  const raw = weekCodesInclusiveRange(from, to)
  return raw.filter((c) => optionSet.has(c))
}

/** 按勾选的项目 id 过滤；未选 = 成员范围内全部项目 */
export function deriveProjectIdsFromSelection(
  memberProjects: MemberProjectOption[],
  selectedProjectIds: string[]
): string[] {
  if (!selectedProjectIds.length) return memberProjects.map((p) => p.id)
  const allow = new Set(memberProjects.map((p) => p.id))
  return selectedProjectIds.filter((id) => allow.has(id))
}

export function resolveEffectiveWeekCodes(
  weekOptions: { week_code: string }[],
  hasWeeksInUrl: boolean,
  weekCodesFromUrl: string[]
): string[] {
  if (!hasWeeksInUrl) return getDefaultWeekFilterCodes(weekOptions)
  return weekCodesFromUrl
}

export function parseWeeklyFilledSearchParams(
  sp: Record<string, string | string[] | undefined>
): WeeklyFilledUrlState {
  const viewRaw = firstString(sp.view)
  const view: MyFilledGroupView =
    viewRaw === 'by_project' ? 'by_project' : 'by_week'

  const hasWeekFrom = Object.prototype.hasOwnProperty.call(sp, 'weekFrom')
  const hasWeekTo = Object.prototype.hasOwnProperty.call(sp, 'weekTo')
  const hasLegacyWeeks = Object.prototype.hasOwnProperty.call(sp, 'weeks')
  const hasWeekRangeInUrl = hasWeekFrom || hasWeekTo || hasLegacyWeeks

  let weekFrom = ''
  let weekTo = ''
  if (hasLegacyWeeks && !hasWeekFrom && !hasWeekTo) {
    const ws = parseCsv(firstString(sp.weeks))
    if (ws.length) {
      weekFrom = ws.reduce((a, b) => (compareWeekCode(a, b) <= 0 ? a : b))
      weekTo = ws.reduce((a, b) => (compareWeekCode(a, b) >= 0 ? a : b))
    }
  } else {
    weekFrom = firstString(sp.weekFrom).trim()
    weekTo = firstString(sp.weekTo).trim()
  }

  const hasProjectsInUrl = Object.prototype.hasOwnProperty.call(sp, 'projects')
  const projects = hasProjectsInUrl ? parseCsv(firstString(sp.projects)) : []

  return {
    view,
    weekFrom,
    weekTo,
    hasWeekRangeInUrl,
    projects,
    hasProjectsInUrl,
  }
}

export function parseWeeklyFilledSearchParamsFromSearchParams(
  sp: URLSearchParams
): WeeklyFilledUrlState {
  return parseWeeklyFilledSearchParams(Object.fromEntries(sp.entries()))
}

export function buildWeeklyFilledSearchParams(
  state: WeeklyFilledUrlState
): URLSearchParams {
  const p = new URLSearchParams()
  if (state.view === 'by_project') p.set('view', 'by_project')
  if (state.hasWeekRangeInUrl) {
    if (state.weekFrom) p.set('weekFrom', state.weekFrom)
    if (state.weekTo) p.set('weekTo', state.weekTo)
  }
  if (state.hasProjectsInUrl) {
    if (state.projects.length) p.set('projects', state.projects.join(','))
    else p.set('projects', '')
  }
  return p
}

/** 审批列表 */
export function parseWeeklyApprovalsSearchParams(
  sp: Record<string, string | string[] | undefined>
): WeeklyApprovalsUrlState {
  const ar = firstString(sp.approval)
  let approval: ApprovalDoneFilter = 'all'
  if (ar === 'done') {
    approval = 'approved'
  } else if (
    ar === 'all' ||
    ar === 'pending' ||
    ar === 'rejected' ||
    ar === 'approved'
  ) {
    approval = ar
  }
  const hasWeeksInUrl = Object.prototype.hasOwnProperty.call(sp, 'weeks')
  const weeks = hasWeeksInUrl ? parseCsv(firstString(sp.weeks)) : []
  const projects = parseCsv(firstString(sp.projects))
  return { approval, weeks, projects, hasWeeksInUrl }
}

export function parseWeeklyApprovalsSearchParamsFromSearchParams(
  sp: URLSearchParams
): WeeklyApprovalsUrlState {
  return parseWeeklyApprovalsSearchParams(Object.fromEntries(sp.entries()))
}

export function buildWeeklyApprovalsSearchParams(
  state: WeeklyApprovalsUrlState
): URLSearchParams {
  const p = new URLSearchParams()
  if (state.approval !== 'all') p.set('approval', state.approval)
  if (state.hasWeeksInUrl) {
    if (state.weeks.length) p.set('weeks', state.weeks.join(','))
    else p.set('weeks', '')
  }
  if (state.projects.length) p.set('projects', state.projects.join(','))
  return p
}
