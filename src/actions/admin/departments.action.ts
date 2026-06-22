'use server'

import { handleAction } from '@/lib/action-handler'
import { BusinessError, ValidationError, NotFoundError } from '@/lib/errors'
import {
  insertDepartment,
  updateDepartment,
  getDepartmentById,
  getDepartmentList,
  softDeleteDepartment,
  countChildDepartments,
  type DepartmentListParams,
  type InsertDepartmentData,
  type UpdateDepartmentData,
} from '@/lib/db/admin/departments'

async function assertParentIsRoot(parentId: string | null) {
  if (!parentId) return
  const parent = await getDepartmentById(parentId)
  if (!parent) throw new NotFoundError('上级部门不存在')
  if (parent.parent_id) {
    throw new BusinessError('子部门不能再挂子部门，请选择根部门作为上级')
  }
}

export async function listDepartments(params: DepartmentListParams) {
  return handleAction(async () => getDepartmentList(params))
}

export async function getDepartment(id: string) {
  return handleAction(async () => {
    const row = await getDepartmentById(id)
    if (!row) throw new NotFoundError('部门不存在')
    return row
  })
}

interface CreateDepartmentInput {
  code: string
  name: string
  parent_id: string | null
}

export async function createDepartment(input: CreateDepartmentInput) {
  return handleAction(async () => {
    if (!input.code?.trim() || !input.name?.trim()) {
      throw new ValidationError('部门编码与名称不能为空')
    }
    const parentId = input.parent_id?.trim() || null
    await assertParentIsRoot(parentId)

    const level = parentId ? 1 : 0
    const row: InsertDepartmentData = {
      code: input.code.trim(),
      name: input.name.trim(),
      parent_id: parentId,
      level,
    }

    const id = await insertDepartment(row)
    return { id }
  })
}

interface UpdateDepartmentInput extends UpdateDepartmentData {
  id: string
}

export async function saveDepartment(input: UpdateDepartmentInput) {
  return handleAction(async () => {
    if (!input.id?.trim()) throw new ValidationError('部门 ID 不能为空')

    const existing = await getDepartmentById(input.id)
    if (!existing) throw new NotFoundError('部门不存在')

    const { id, ...updates } = input
    if (Object.keys(updates).length === 0) {
      throw new ValidationError('没有需要保存的修改')
    }

    if (updates.parent_id !== undefined) {
      if (updates.parent_id === id) {
        throw new BusinessError('不能将上级设为自己')
      }
      await assertParentIsRoot(updates.parent_id)
    }

    const nextParentId = updates.parent_id !== undefined ? updates.parent_id : existing.parent_id
    const nextLevel = nextParentId ? 1 : 0

    const patch: UpdateDepartmentData = { ...updates }
    if (updates.parent_id !== undefined) {
      patch.level = nextLevel
    }
    if (patch.parent_id === '') patch.parent_id = null

    await updateDepartment(id, patch)

    return { id }
  })
}

export async function removeDepartment(id: string) {
  return handleAction(async () => {
    if (!id?.trim()) throw new ValidationError('部门 ID 不能为空')

    const existing = await getDepartmentById(id)
    if (!existing) throw new NotFoundError('部门不存在')

    const children = await countChildDepartments(id)
    if (children > 0) {
      throw new BusinessError('请先删除或移走子部门后再删除本部门')
    }

    await softDeleteDepartment(id)

    return { id }
  })
}
