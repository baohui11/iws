import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().min(1, '请输入邮箱').email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().min(1, '请输入邮箱').email('邮箱格式不正确'),
})

export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetSchema
>

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

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '请输入当前密码'),
    newPassword: z.string().min(8, '新密码长度不能少于 8 位'),
    confirmPassword: z.string().min(1, '请确认新密码'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: '两次输入的新密码不一致',
    path: ['confirmPassword'],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: '新密码不能与当前密码相同',
    path: ['newPassword'],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export const resetPasswordWithTokenSchema = z
  .object({
    token: z.string().trim().min(1, '重置链接无效'),
    password: z.string().min(8, '密码长度不能少于 8 位'),
    confirmPassword: z.string().min(1, '请确认密码'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  })

export type ResetPasswordWithTokenInput = z.infer<
  typeof resetPasswordWithTokenSchema
>
