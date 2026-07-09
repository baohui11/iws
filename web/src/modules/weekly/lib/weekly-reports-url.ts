/** 我填写的周报：?view=&weekFrom=&weekTo=&projects=（旧 weeks= 仍可读） */

import type { MemberProjectOption, MyFilledGroupView } from '@/modules/weekly/types'
import {
  compareWeekCode,
  getCurrentWeekCode,
  shiftWeekCode,
  weekCodesInclusiveRange,
} from '@/modules/weekly/lib/iso-week'

export type WeeklyFilledUrlState = {
  view: MyFilledGroupView
  weekFrom: string
  weekTo: string
  hasWeekRangeInUrl: boolean
  projects: string[]
  hasProjectsInUrl: boolean
}

function firstString(v: string | string[] | undefined): string {
  if (v == null) return ''
  return typeof v === 'string' ? v : (v[0] ?? '')
}

function parseCsv(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

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

export function getDefaultApprovalWeekRange(
  weekOptions: { week_code: string }[]
): { weekFrom: string; weekTo: string } {
  const set = new Set(weekOptions.map((w) => w.week_code))
  const cur = getCurrentWeekCode()
  const end = set.has(cur) ? cur : (weekOptions[0]?.week_code ?? cur)
  const prev = shiftWeekCode(end, -1)
  const start = prev && set.has(prev) ? prev : end
  return compareWeekCode(start, end) <= 0
    ? { weekFrom: start, weekTo: end }
    : { weekFrom: end, weekTo: start }
}

export function resolveApprovalWeekCodes(
  weekOptions: { week_code: string }[],
  state: { hasWeekRangeInUrl: boolean; weekFrom: string; weekTo: string }
): string[] {
  const optionSet = new Set(weekOptions.map((w) => w.week_code))
  const defaults = getDefaultApprovalWeekRange(weekOptions)

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
