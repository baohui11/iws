import { z } from 'zod'
import { SYSTEM_ROLE_VALUES } from '@/constants/system-roles'

const roleEnum = z.enum(SYSTEM_ROLE_VALUES)

export const createUserSchema = z.object({
  employee_no: z.string().trim().min(1, '工号不能为空'),
  name: z.string().trim().min(1, '姓名不能为空'),
  gender: z.string().trim().min(1, '性别不能为空'),
  department_id: z.string().trim().min(1, '部门不能为空'),
  position: z.string().trim().min(1, '职位不能为空'),
  email: z.string().trim().min(1, '邮箱不能为空').email('邮箱格式不正确'),
  role: roleEnum.optional(),
})

export const updateUserSchema = z.object({
  id: z.string().trim().min(1, '用户 ID 不能为空'),
  name: z.string().trim().min(1).optional(),
  gender: z.string().trim().optional(),
  employee_no: z.string().trim().min(1).optional(),
  department_id: z.string().trim().min(1).optional(),
  position: z.string().trim().optional(),
  role: roleEnum.optional(),
  email: z.string().trim().email('邮箱格式不正确').optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
