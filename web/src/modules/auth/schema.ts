import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().min(1, '请输入邮箱').email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const setPasswordSchema = z
  .object({
    password: z.string().min(8, '密码长度不能少于 8 位'),
    confirmPassword: z.string().min(1, '请确认密码'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  })

export type SetPasswordInput = z.infer<typeof setPasswordSchema>
