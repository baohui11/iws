import { BusinessError, NotFoundError, ValidationError } from '@/core/errors'
import { requireAdmin } from '@/modules/org/guard'
import {
  countChildDepartments,
  getDepartmentById,
  getDepartmentList,
  insertDepartment,
  softDeleteDepartment,
  updateDepartment,
  type DepartmentListParams,
  type UpdateDepartmentData,
} from './repo'
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
} from './schema'

async function assertParentIsRoot(parentId: string | null) {
  if (!parentId) return
  const parent = await getDepartmentById(parentId)
  if (!parent) throw new NotFoundError('上级部门不存在')
  if (parent.parent_id) {
    throw new BusinessError('子部门不能再挂子部门，请选择根部门作为上级')
  }
}

export async function listDepartments(params: DepartmentListParams) {
  await requireAdmin()
  return getDepartmentList(params)
}

export async function getDepartment(id: string) {
  await requireAdmin()
  const row = await getDepartmentById(id)
  if (!row) throw new NotFoundError('部门不存在')
  return row
}

export async function createDepartment(input: CreateDepartmentInput) {
  await requireAdmin()
  const parsed = createDepartmentSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? '参数不合法')
  }
  const parentId = parsed.data.parent_id?.trim() || null
  await assertParentIsRoot(parentId)

  const id = await insertDepartment({
    code: parsed.data.code,
    name: parsed.data.name,
    parent_id: parentId,
    level: parentId ? 1 : 0,
  })
  return { id }
}

export async function saveDepartment(input: UpdateDepartmentInput) {
  await requireAdmin()
  const parsed = updateDepartmentSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? '参数不合法')
  }
  const { id, ...updates } = parsed.data

  const existing = await getDepartmentById(id)
  if (!existing) throw new NotFoundError('部门不存在')
  if (Object.keys(updates).length === 0) {
    throw new ValidationError('没有需要保存的修改')
  }

  if (updates.parent_id !== undefined) {
    if (updates.parent_id === id) {
      throw new BusinessError('不能将上级设为自己')
    }
    await assertParentIsRoot(updates.parent_id ?? null)
  }

  const patch: UpdateDepartmentData = { ...updates }
  if (updates.parent_id !== undefined) {
    const next = updates.parent_id || null
    patch.parent_id = next
    patch.level = next ? 1 : 0
  }

  await updateDepartment(id, patch)
  return { id }
}

export async function removeDepartment(id: string) {
  await requireAdmin()
  if (!id?.trim()) throw new ValidationError('部门 ID 不能为空')

  const existing = await getDepartmentById(id)
  if (!existing) throw new NotFoundError('部门不存在')

  const children = await countChildDepartments(id)
  if (children > 0) {
    throw new BusinessError('请先删除或移走子部门后再删除本部门')
  }

  await softDeleteDepartment(id)
  return { id }
}
