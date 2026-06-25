import { requireUser } from '@/core/auth'
import { getDepartmentIdsForListFilter, getDepartmentTree } from '@/modules/org/departments/repo'
import { getMemberProjectsForWeeklyFilter } from '@/modules/weekly/reports/repo'
import { formatDepartmentOptionsForStats } from '@/modules/stats/lib/stats-department-options'

/** 文件检索页：部门树（与统计一致）+ 当前用户参与的项目列表 */
export async function getFileSearchPageData() {
  const user = await requireUser()
  const tree = await getDepartmentTree()

  let allowedIds: string[] | null = null
  if (user.role !== 'admin' && user.departmentId) {
    allowedIds = await getDepartmentIdsForListFilter(user.departmentId)
  }

  const departmentOptions = formatDepartmentOptionsForStats(tree, allowedIds)
  const memberProjects = await getMemberProjectsForWeeklyFilter(user.id)
  const projectOptions = memberProjects.map((p) => ({
    id: p.id,
    label: p.project_name?.trim() || p.project_no?.trim() || p.id,
  }))

  return { departmentOptions, projectOptions }
}
