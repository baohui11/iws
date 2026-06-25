/**
 * 应用级登录拦截（Next 16 proxy 约定，等价旧 middleware）：
 * 未登录访问受保护路径 → /login。仅校验会话令牌；
 * 细粒度角色/数据权限在各域 service 内用 core/auth 处理。
 */
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/core/auth/session-token'

const PUBLIC_PATHS = ['/login', '/api/auth']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const userId = token ? await verifySessionToken(token) : null

  if (!userId && !isPublic) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (userId && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
