import { NotFoundError, ValidationError } from '@/core/errors'
import { requireAdmin } from '@/modules/org/guard'
import {
  getDepartmentById,
  getDepartmentList,
  updateDepartmentActive as updateDepartmentActiveRow,
  type DepartmentListParams,
} from './repo'

export async function listDepartments(params: DepartmentListParams) {
  await requireAdmin()
  return getDepartmentList(params)
}

export async function updateDepartmentActive(input: {
  id: string
  is_active: boolean
}) {
  await requireAdmin()
  if (!input.id?.trim()) throw new ValidationError('部门 ID 不能为空')
  if (typeof input.is_active !== 'boolean') {
    throw new ValidationError('激活状态不合法')
  }
  const existing = await getDepartmentById(input.id)
  if (!existing) throw new NotFoundError('部门不存在')
  await updateDepartmentActiveRow(input.id, input.is_active)
  return { id: input.id, is_active: input.is_active }
}
