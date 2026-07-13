import { requireUser } from '@/core/auth'
import { BusinessError, ValidationError } from '@/core/errors'
import {
  getAllActiveDepartmentIds,
  getAdminDepartmentScopeIds,
  getDepartmentIdsForListFilter,
  getDepartmentTree,
} from '@/modules/org/departments/repo'
import type { CurrentUser } from '@/core/auth/current-user'
import { getWeekOptionsUpToCurrent } from '@/modules/weekly/reports/repo'
import { formatDepartmentOptionsForStats } from '@/modules/stats/lib/stats-department-options'
import { getYearMonthOfCurrentWeek } from '@/modules/stats/lib/stats-year-month'
import { assertStatsRole } from './lib/access'
import {
  getAttendanceDetails,
  getAttendanceProjectSummary,
  getAttendanceSummary,
  getFileDownloadCountByPerson,
  getMyAttendanceDetails,
  getWeeklyDeptByPerson,
  getWeeklyDeptByProject,
  getWeeklyDeptDetails,
  getWeeklyProjectPersonRange,
  listFileDownloadDetailsForAudit,
  listFilesStatsPage,
} from './repo'

function assertYearMonth(v: string): string {
  const s = v?.trim()
  if (!s || !/^\d{4}-\d{2}$/.test(s)) {
    throw new ValidationError('请选择有效月份（YYYY-MM）')
  }
  const m = Number(s.slice(5, 7))
  if (m < 1 || m > 12) throw new ValidationError('月份无效')
  return s
}

function buildWeeklyParams(
  departmentIds: string[] | null,
  weekCode: string,
  personNameKeyword?: string | null,
  projectKeyword?: string | null,
  projectStage?: string | null
) {
  const w = weekCode?.trim()
  if (!w) throw new ValidationError('请选择周次')
  return {
    departmentIds,
    weekCode: w,
    personNameKeyword: personNameKeyword?.trim() || undefined,
    projectKeyword: projectKeyword?.trim() || undefined,
    projectStage: projectStage?.trim() || undefined,
  }
}

async function resolveStatsDepartmentIds(
  user: CurrentUser,
  selectedDepartmentId: string | null | undefined
): Promise<string[] | null> {
  assertStatsRole(user)
  const did = selectedDepartmentId?.trim()
  if (!did) throw new ValidationError('请选择部门')

  const allowedIds = await getAdminDepartmentScopeIds(user)
  if (did === 'all') return allowedIds ?? getAllActiveDepartmentIds()

  if (allowedIds && !allowedIds.includes(did)) {
    throw new BusinessError('无权查看该部门数据')
  }
  return getDepartmentIdsForListFilter(did)
}

export async function loadMyAttendanceDetails(yearMonth: string) {
  const user = await requireUser()
  const ym = assertYearMonth(yearMonth)
  return getMyAttendanceDetails(user.id, ym)
}

export async function loadAttendanceSummary(departmentId: string, yearMonth: string) {
  const user = await requireUser()
  const departmentIds = await resolveStatsDepartmentIds(user, departmentId)
  const ym = assertYearMonth(yearMonth)
  return getAttendanceSummary(departmentIds, ym)
}

export async function loadAttendanceDetails(departmentId: string, yearMonth: string) {
  const user = await requireUser()
  const departmentIds = await resolveStatsDepartmentIds(user, departmentId)
  const ym = assertYearMonth(yearMonth)
  return getAttendanceDetails(departmentIds, ym)
}

export async function loadAttendanceProjectSummary(
  departmentId: string,
  yearMonth: string
) {
  const user = await requireUser()
  const departmentIds = await resolveStatsDepartmentIds(user, departmentId)
  const ym = assertYearMonth(yearMonth)
  return getAttendanceProjectSummary(departmentIds, ym)
}

export async function loadFilesStatsPage(
  departmentId: string | null,
  fileNameKeyword: string | null,
  projectKeyword: string | null,
  offset: number,
  limit: number
) {
  const user = await requireUser()
  const departmentIds = await resolveStatsDepartmentIds(
    user,
    departmentId?.trim() || 'all'
  )

  return listFilesStatsPage({
    departmentIds,
    fileNameKeyword: fileNameKeyword?.trim() || null,
    projectKeyword: projectKeyword?.trim() || null,
    offset,
    limit,
  })
}

export async function loadFileDownloadByPerson(input: {
  dateFrom: string
  dateTo: string
  nameKeyword: string | null
}) {
  const user = await requireUser()
  assertStatsRole(user)
  return getFileDownloadCountByPerson({
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    nameKeyword: input.nameKeyword?.trim() || null,
  })
}

export async function loadFileDownloadDetails(input: {
  dateFrom: string
  dateTo: string
  nameKeyword: string | null
  offset: number
  limit: number
}) {
  const user = await requireUser()
  assertStatsRole(user)
  return listFileDownloadDetailsForAudit({
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    nameKeyword: input.nameKeyword?.trim() || null,
    offset: input.offset,
    limit: input.limit,
  })
}

export async function loadWeeklyDeptByPerson(
  departmentId: string,
  weekCode: string,
  personNameKeyword?: string | null,
  projectKeyword?: string | null,
  projectStage?: string | null
) {
  const user = await requireUser()
  const departmentIds = await resolveStatsDepartmentIds(user, departmentId)
  const params = buildWeeklyParams(departmentIds, weekCode, personNameKeyword, projectKeyword, projectStage)
  return getWeeklyDeptByPerson(params)
}

export async function loadWeeklyDeptByProject(
  departmentId: string,
  weekCode: string,
  personNameKeyword?: string | null,
  projectKeyword?: string | null,
  projectStage?: string | null
) {
  const user = await requireUser()
  const departmentIds = await resolveStatsDepartmentIds(user, departmentId)
  const params = buildWeeklyParams(departmentIds, weekCode, personNameKeyword, projectKeyword, projectStage)
  return getWeeklyDeptByProject(params)
}

export async function loadWeeklyDeptDetails(
  departmentId: string,
  weekCode: string,
  personNameKeyword?: string | null,
  projectKeyword?: string | null,
  projectStage?: string | null
) {
  const user = await requireUser()
  const departmentIds = await resolveStatsDepartmentIds(user, departmentId)
  const params = buildWeeklyParams(departmentIds, weekCode, personNameKeyword, projectKeyword, projectStage)
  return getWeeklyDeptDetails(params)
}

export async function loadWeeklyProjectPersonRange(input: {
  departmentId: string
  projectKeyword: string
  projectStage?: string | null
  weekCodeFrom: string
  weekCodeTo: string
  personNameKeyword?: string | null
}) {
  const user = await requireUser()
  const departmentIds = await resolveStatsDepartmentIds(user, input.departmentId)
  const projectKeyword = input.projectKeyword?.trim()
  const from = input.weekCodeFrom?.trim()
  const to = input.weekCodeTo?.trim()
  if (!from || !to) throw new ValidationError('请选择周区间')
  return getWeeklyProjectPersonRange({
    departmentIds,
    projectKeyword: projectKeyword || '',
    projectStage: input.projectStage?.trim() || undefined,
    weekCodeFrom: from,
    weekCodeTo: to,
    personNameKeyword: input.personNameKeyword?.trim() || undefined,
  })
}

export async function getWeeklyStatsPageData() {
  const user = await requireUser()
  assertStatsRole(user)
  const tree = await getDepartmentTree()
  const weekOptions = await getWeekOptionsUpToCurrent(104)

  const allowedIds = await getAdminDepartmentScopeIds(user)

  const departmentOptions = formatDepartmentOptionsForStats(tree, allowedIds)

  const initialDepartmentId =
    departmentOptions.length > 1
      ? 'all'
      : user.departmentId && allowedIds?.includes(user.departmentId)
        ? user.departmentId
        : (departmentOptions[0]?.id ?? '')

  const initialWeekCode =
    weekOptions.find((w) => w.is_current)?.week_code ??
    weekOptions[0]?.week_code ??
    ''

  return {
    departmentOptions,
    weekOptions,
    initialDepartmentId,
    initialWeekCode,
  }
}

export async function getAttendanceStatsPageData() {
  const user = await requireUser()
  assertStatsRole(user)
  const tree = await getDepartmentTree()

  const allowedIds = await getAdminDepartmentScopeIds(user)

  const departmentOptions = formatDepartmentOptionsForStats(tree, allowedIds)

  const initialDepartmentId =
    departmentOptions.length > 1
      ? 'all'
      : user.departmentId && allowedIds?.includes(user.departmentId)
        ? user.departmentId
        : (departmentOptions[0]?.id ?? '')

  const initialYearMonth = getYearMonthOfCurrentWeek()

  return {
    departmentOptions,
    initialDepartmentId,
    initialYearMonth,
  }
}

export async function getFilesStatsPageData() {
  const user = await requireUser()
  assertStatsRole(user)
  const tree = await getDepartmentTree()

  const allowedIds = await getAdminDepartmentScopeIds(user)

  const departmentOptions = formatDepartmentOptionsForStats(tree, allowedIds)

  const initialDepartmentId =
    departmentOptions.length > 1
      ? 'all'
      : user.departmentId && allowedIds?.includes(user.departmentId)
        ? user.departmentId
        : (departmentOptions[0]?.id ?? '')

  return {
    departmentOptions,
    initialDepartmentId,
  }
}
