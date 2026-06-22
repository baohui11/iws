import type { DepartmentNode } from '@/lib/db/admin/departments'

export interface FlatDepartmentLink {
  id: string
  name: string
  parent_id: string | null
}

/** 将部门树拍平，用于根据 id 向上拼接「一级 / 二级」路径 */
export function flattenDepartmentTree(nodes: DepartmentNode[]): FlatDepartmentLink[] {
  const out: FlatDepartmentLink[] = []
  function walk(n: DepartmentNode, parentId: string | null) {
    out.push({ id: n.id, name: n.name, parent_id: parentId })
    for (const c of n.children ?? []) {
      walk(c, n.id)
    }
  }
  for (const root of nodes) {
    walk(root, null)
  }
  return out
}

/** 展示为「一级部门 / 二级部门」；无层级时仅显示名称；无法解析时用 fallbackName */
export function formatDepartmentPathLabel(
  departmentId: string | null | undefined,
  flat: FlatDepartmentLink[],
  fallbackName?: string | null
): string {
  if (!departmentId) {
    return fallbackName?.trim() || '—'
  }
  const byId = new Map(flat.map((n) => [n.id, n]))
  const parts: string[] = []
  let cur = byId.get(departmentId)
  const guard = new Set<string>()
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id)
    parts.unshift(cur.name)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  if (parts.length) {
    return parts.join(' / ')
  }
  return fallbackName?.trim() || '—'
}
