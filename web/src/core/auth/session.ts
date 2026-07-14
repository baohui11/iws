/**
 * 会话 cookie 读写（服务端 Server Action / Route / Server Component）。
 */
import { cookies } from 'next/headers'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  signSessionToken,
  verifySessionToken,
} from './session-token'

function shouldUseSecureCookie(): boolean {
  const override = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase()
  if (override) return ['1', 'true', 'yes', 'on'].includes(override)

  const baseUrl = process.env.APP_BASE_URL?.trim()
  if (!baseUrl) return false

  try {
    return new URL(baseUrl).protocol === 'https:'
  } catch {
    return baseUrl.startsWith('https://')
  }
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = await signSessionToken(userId)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookie(),
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}
