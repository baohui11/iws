import { requireUser } from '@/core/auth'
import { getDepartmentTree } from '@/modules/org/departments/repo'
import { getFileDepartmentScopeIds } from '@/modules/files/access'
import { formatDepartmentOptionsForStats } from '@/modules/stats/lib/stats-department-options'

/** 文件检索页：部门树（与统计一致）。项目用名称/编号模糊输入，不预加载项目列表。 */
export async function getFileSearchPageData() {
  const user = await requireUser()
  const tree = await getDepartmentTree()
  const allowedIds = await getFileDepartmentScopeIds(user)

  const departmentOptions = formatDepartmentOptionsForStats(tree, allowedIds)
  return { departmentOptions }
}
