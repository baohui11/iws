import { createHash, randomBytes } from 'node:crypto'
import { AuthError, BusinessError, ValidationError } from '@/core/errors'
import {
  setSessionCookie,
  clearSessionCookie,
  verifyPassword,
  hashPassword,
  requireUser,
} from '@/core/auth'
import { sendMail } from '@/core/email/mailer'
import {
  renderInviteEmail,
  renderPasswordResetEmail,
} from '@/core/email/templates'
import { buildPasswordTokenUrl } from '@/core/email/url'
import {
  consumeEmailTokenAndSetPassword,
  createEmailToken,
  findActiveUserAuthById,
  findActiveUserByEmail,
  findUserAuthByEmail,
  findValidEmailToken,
  updatePasswordById,
} from './repo'
import {
  changePasswordSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordWithTokenSchema,
  setPasswordSchema,
  type ChangePasswordInput,
  type LoginInput,
  type RequestPasswordResetInput,
  type ResetPasswordWithTokenInput,
  type SetPasswordInput,
} from './schema'

const EMAIL_TOKEN_EXPIRES_MS = 24 * 60 * 60 * 1000

function createRawToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashEmailToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function createPasswordToken(input: {
  userId: string
  purpose: 'invite' | 'password_reset'
}) {
  const token = createRawToken()
  await createEmailToken({
    userId: input.userId,
    purpose: input.purpose,
    tokenHash: hashEmailToken(token),
    expiresAt: new Date(Date.now() + EMAIL_TOKEN_EXPIRES_MS),
  })
  return token
}

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

/** 忘记密码：不暴露邮箱是否存在。 */
export async function requestPasswordReset(
  input: RequestPasswordResetInput
): Promise<void> {
  const parsed = requestPasswordResetSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? '参数不合法')
  }

  const user = await findUserAuthByEmail(parsed.data.email)
  if (!user?.email || !user.isActive) return

  const token = await createPasswordToken({
    userId: user.id,
    purpose: 'password_reset',
  })
  const url = buildPasswordTokenUrl({ token, type: 'password_reset' })
  await sendMail({
    to: user.email,
    subject: '周报文件系统 - 密码重置',
    html: renderPasswordResetEmail(url),
    text: `请打开链接重置密码：${url}`,
  })
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

/** 个人中心修改登录密码：必须校验当前密码。 */
export async function changeOwnPassword(
  input: ChangePasswordInput
): Promise<void> {
  const user = await requireUser()
  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? '参数不合法')
  }

  const authUser = await findActiveUserAuthById(user.id)
  if (!authUser) throw new AuthError('请先登录')
  if (!authUser.passwordHash) {
    throw new BusinessError('当前账号尚未设置登录密码，请先完成初始密码设置')
  }

  const ok = await verifyPassword(
    parsed.data.currentPassword,
    authUser.passwordHash
  )
  if (!ok) throw new ValidationError('当前密码不正确')

  await updatePasswordById(
    user.id,
    await hashPassword(parsed.data.newPassword)
  )
}

export async function resetPasswordWithToken(
  input: ResetPasswordWithTokenInput
): Promise<void> {
  const parsed = resetPasswordWithTokenSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? '参数不合法')
  }

  const tokenHash = hashEmailToken(parsed.data.token)
  const tokenRow = await findValidEmailToken({ tokenHash })
  if (!tokenRow) throw new ValidationError('重置链接无效或已过期')

  await consumeEmailTokenAndSetPassword({
    tokenId: tokenRow.id,
    userId: tokenRow.userId,
    passwordHash: await hashPassword(parsed.data.password),
    activateUser: tokenRow.purpose === 'invite',
  })
  await setSessionCookie(tokenRow.userId)
}

export async function verifyPasswordResetToken(input: {
  token: string
  type?: 'invite' | 'password_reset'
}): Promise<{ valid: boolean; type: 'invite' | 'password_reset' | null }> {
  const token = input.token?.trim()
  if (!token) return { valid: false, type: null }

  const tokenRow = await findValidEmailToken({
    tokenHash: hashEmailToken(token),
    purpose: input.type,
  })
  if (!tokenRow) return { valid: false, type: null }
  return {
    valid: true,
    type: tokenRow.purpose === 'invite' ? 'invite' : 'password_reset',
  }
}

export async function sendInviteEmail(input: {
  userId: string
  email: string | null
}): Promise<boolean> {
  const email = input.email?.trim()
  if (!email) return false

  const token = await createPasswordToken({
    userId: input.userId,
    purpose: 'invite',
  })
  const url = buildPasswordTokenUrl({ token, type: 'invite' })
  await sendMail({
    to: email,
    subject: '周报文件系统 - 账号邀请',
    html: renderInviteEmail(url),
    text: `请打开链接完成账号设置：${url}`,
  })
  return true
}
