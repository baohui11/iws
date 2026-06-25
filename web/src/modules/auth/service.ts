import { AuthError, ValidationError } from '@/core/errors'
import {
  setSessionCookie,
  clearSessionCookie,
  verifyPassword,
  hashPassword,
  requireUser,
} from '@/core/auth'
import { findActiveUserByEmail, updatePasswordById } from './repo'
import {
  loginSchema,
  setPasswordSchema,
  type LoginInput,
  type SetPasswordInput,
} from './schema'

/**
 * 登录：校验邮箱密码 → 写会话 cookie。
 * 失败统一返回模糊提示，避免账号枚举。
 */
export async function login(input: LoginInput): Promise<void> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? '参数不合法')
  }

  const user = await findActiveUserByEmail(parsed.data.email)
  if (!user || !user.passwordHash) {
    throw new AuthError('邮箱或密码错误')
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash)
  if (!ok) {
    throw new AuthError('邮箱或密码错误')
  }

  await setSessionCookie(user.id)
}

export async function logout(): Promise<void> {
  await clearSessionCookie()
}

/** 当前用户修改自己的登录密码。 */
export async function setOwnPassword(input: SetPasswordInput): Promise<void> {
  const user = await requireUser()
  const parsed = setPasswordSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? '参数不合法')
  }
  await updatePasswordById(user.id, await hashPassword(parsed.data.password))
}
