import type { DepartmentNode } from '@/modules/org/departments/repo'
import {
  flattenDepartmentTree,
  formatDepartmentPathLabel,
} from '@/modules/org/departments/display'
import type { DeptOption } from '@/modules/stats/types'

/** 供下拉框：部门树拍平后按可访问范围过滤 */
export function formatDepartmentOptionsForStats(
  tree: DepartmentNode[],
  allowedIds: string[] | null
): DeptOption[] {
  const flat = flattenDepartmentTree(tree)
  const list = allowedIds
    ? flat.filter((n) => allowedIds.includes(n.id))
    : flat
  return list.map((n) => ({
    id: n.id,
    label: formatDepartmentPathLabel(n.id, flat, n.name),
  }))
}
