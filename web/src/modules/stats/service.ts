import { requireUser } from '@/core/auth'
import { ValidationError } from '@/core/errors'
import { getDepartmentIdsForListFilter, getDepartmentTree } from '@/modules/org/departments/repo'
import { getWeekOptionsUpToCurrent } from '@/modules/weekly/reports/repo'
import { formatDepartmentOptionsForStats } from '@/modules/stats/lib/stats-department-options'
import { getYearMonthOfCurrentWeek } from '@/modules/stats/lib/stats-year-month'
import { assertDeptStatsAccess, assertStatsRole } from './lib/access'
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
  departmentId: string,
  weekCode: string,
  personNameKeyword?: string | null,
  projectKeyword?: string | null,
  projectStage?: string | null
) {
  const d = departmentId?.trim()
  const w = weekCode?.trim()
  if (!d) throw new ValidationError('请选择部门')
  if (!w) throw new ValidationError('请选择周次')
  return {
    departmentId: d,
    weekCode: w,
    personNameKeyword: personNameKeyword?.trim() || undefined,
    projectKeyword: projectKeyword?.trim() || undefined,
    projectStage: projectStage?.trim() || undefined,
  }
}

export async function loadMyAttendanceDetails(yearMonth: string) {
  const user = await requireUser()
  const ym = assertYearMonth(yearMonth)
  return getMyAttendanceDetails(user.id, ym)
}

export async function loadAttendanceSummary(departmentId: string, yearMonth: string) {
  const user = await requireUser()
  const did = departmentId?.trim()
  if (!did) throw new ValidationError('请选择部门')
  await assertDeptStatsAccess(user, did)
  const ym = assertYearMonth(yearMonth)
  return getAttendanceSummary(did, ym)
}

export async function loadAttendanceDetails(departmentId: string, yearMonth: string) {
  const user = await requireUser()
  const did = departmentId?.trim()
  if (!did) throw new ValidationError('请选择部门')
  await assertDeptStatsAccess(user, did)
  const ym = assertYearMonth(yearMonth)
  return getAttendanceDetails(did, ym)
}

export async function loadAttendanceProjectSummary(
  departmentId: string,
  yearMonth: string
) {
  const user = await requireUser()
  const did = departmentId?.trim()
  if (!did) throw new ValidationError('请选择部门')
  await assertDeptStatsAccess(user, did)
  const ym = assertYearMonth(yearMonth)
  return getAttendanceProjectSummary(did, ym)
}

export async function loadFilesStatsPage(
  departmentId: string | null,
  fileNameKeyword: string | null,
  projectKeyword: string | null,
  offset: number,
  limit: number
) {
  const user = await requireUser()
  assertStatsRole(user)

  const did = departmentId?.trim() || null
  if (user.role !== 'admin' && !did) {
    throw new ValidationError('请选择部门')
  }
  if (user.role !== 'admin' && did) {
    await assertDeptStatsAccess(user, did)
  }

  return listFilesStatsPage({
    role: user.role,
    departmentId: user.role === 'admin' ? did : did,
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
  await assertDeptStatsAccess(user, departmentId)
  const params = buildWeeklyParams(departmentId, weekCode, personNameKeyword, projectKeyword, projectStage)
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
  await assertDeptStatsAccess(user, departmentId)
  const params = buildWeeklyParams(departmentId, weekCode, personNameKeyword, projectKeyword, projectStage)
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
  await assertDeptStatsAccess(user, departmentId)
  const params = buildWeeklyParams(departmentId, weekCode, personNameKeyword, projectKeyword, projectStage)
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
  const departmentId = input.departmentId?.trim()
  if (!departmentId) throw new ValidationError('请选择部门')
  await assertDeptStatsAccess(user, departmentId)
  const projectKeyword = input.projectKeyword?.trim()
  if (!projectKeyword) throw new ValidationError('请输入项目名称或编号')
  const from = input.weekCodeFrom?.trim()
  const to = input.weekCodeTo?.trim()
  if (!from || !to) throw new ValidationError('请选择周区间')
  return getWeeklyProjectPersonRange({
    departmentId,
    projectKeyword,
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

  let allowedIds: string[] | null = null
  if (user.role !== 'admin' && user.departmentId) {
    allowedIds = await getDepartmentIdsForListFilter(user.departmentId)
  }

  const departmentOptions = formatDepartmentOptionsForStats(tree, allowedIds)

  const initialDepartmentId =
    user.role === 'admin'
      ? (departmentOptions[0]?.id ?? '')
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

  let allowedIds: string[] | null = null
  if (user.role !== 'admin' && user.departmentId) {
    allowedIds = await getDepartmentIdsForListFilter(user.departmentId)
  }

  const departmentOptions = formatDepartmentOptionsForStats(tree, allowedIds)

  const initialDepartmentId =
    user.role === 'admin'
      ? (departmentOptions[0]?.id ?? '')
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

  let allowedIds: string[] | null = null
  if (user.role !== 'admin' && user.departmentId) {
    allowedIds = await getDepartmentIdsForListFilter(user.departmentId)
  }

  const departmentOptions = formatDepartmentOptionsForStats(tree, allowedIds)

  const initialDepartmentId =
    user.role === 'admin'
      ? 'all'
      : user.departmentId && allowedIds?.includes(user.departmentId)
        ? user.departmentId
        : (departmentOptions[0]?.id ?? '')

  return {
    departmentOptions,
    initialDepartmentId,
    isAdmin: user.role === 'admin',
  }
}
