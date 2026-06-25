import { z } from 'zod'

export const createDepartmentSchema = z.object({
  code: z.string().trim().min(1, '部门编码不能为空'),
  name: z.string().trim().min(1, '部门名称不能为空'),
  parent_id: z.string().trim().nullable().optional(),
})

export const updateDepartmentSchema = z.object({
  id: z.string().trim().min(1, '部门 ID 不能为空'),
  code: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  parent_id: z.string().trim().nullable().optional(),
})

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>
