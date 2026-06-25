/**
 * 会话令牌（纯 jose，无 next/headers 依赖，可在中间件 edge 运行时使用）。
 */
import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'iws_session'
const MAX_AGE_SEC = 60 * 60 * 24 * 7 // 7 天

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET 未配置')
  return new TextEncoder().encode(s)
}

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(getSecret())
}

/** 校验令牌，返回 userId；无效返回 null。 */
export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

export const SESSION_MAX_AGE_SEC = MAX_AGE_SEC
