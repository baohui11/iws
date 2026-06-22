import {
  getDepartmentIdsForListFilter,
  getDepartmentTree,
} from '@/lib/db/admin/departments'
import { getSessionProfile } from '@/lib/db/auth/profile'
import { formatDepartmentOptionsForStats } from '@/lib/db/stats/files-stats'
import { getYearMonthOfCurrentWeek } from '@/lib/utils/stats-year-month'
import {
  getMemberProjectsForWeeklyFilter,
  getWeekOptionsUpToCurrent,
} from '@/lib/db/weekly/reports'

export async function getWeeklyStatsPageData() {
  const profile = await getSessionProfile()
  const tree = await getDepartmentTree()
  const weekOptions = await getWeekOptionsUpToCurrent(104)

  let allowedIds: string[] | null = null
  if (profile.role !== 'admin' && profile.department_id) {
    allowedIds = await getDepartmentIdsForListFilter(profile.department_id)
  }

  const departmentOptions = formatDepartmentOptionsForStats(tree, allowedIds)

  const initialDepartmentId =
    profile.role === 'admin'
      ? (departmentOptions[0]?.id ?? '')
      : profile.department_id && allowedIds?.includes(profile.department_id)
        ? profile.department_id
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

/** 考勤统计页：部门选项 + 默认月份（当月） */
export async function getAttendanceStatsPageData() {
  const profile = await getSessionProfile()
  const tree = await getDepartmentTree()

  let allowedIds: string[] | null = null
  if (profile.role !== 'admin' && profile.department_id) {
    allowedIds = await getDepartmentIdsForListFilter(profile.department_id)
  }

  const departmentOptions = formatDepartmentOptionsForStats(tree, allowedIds)

  const initialDepartmentId =
    profile.role === 'admin'
      ? (departmentOptions[0]?.id ?? '')
      : profile.department_id && allowedIds?.includes(profile.department_id)
        ? profile.department_id
        : (departmentOptions[0]?.id ?? '')

  const initialYearMonth = getYearMonthOfCurrentWeek()

  return {
    departmentOptions,
    initialDepartmentId,
    initialYearMonth,
  }
}

/** 文件检索页：部门树（与统计一致）+ 当前用户参与的项目列表 */
export async function getFileSearchPageData() {
  const profile = await getSessionProfile()
  const tree = await getDepartmentTree()

  let allowedIds: string[] | null = null
  if (profile.role !== 'admin' && profile.department_id) {
    allowedIds = await getDepartmentIdsForListFilter(profile.department_id)
  }

  const departmentOptions = formatDepartmentOptionsForStats(tree, allowedIds)
  const memberProjects = await getMemberProjectsForWeeklyFilter(profile.id)
  const projectOptions = memberProjects.map((p) => ({
    id: p.id,
    label: p.project_name?.trim() || p.project_no?.trim() || p.id,
  }))

  return { departmentOptions, projectOptions }
}
