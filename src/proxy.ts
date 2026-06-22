/**
 * 应用级「是否登录」仅此一处：未登录访问非公开路径 → /login。
 * 各 route layout 不再重复做登录判断，只做角色或数据权限（如 /stats、/admin）。
 */
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { createServerClient } from '@supabase/ssr'
import { resolvePublicOrigin } from '@/lib/utils/resolve-public-origin'

const PUBLIC_PATHS = [
  '/login',
  '/set-password',
  '/error',
  '/api/auth/confirm',
  '/test',
]

export async function proxy(request: NextRequest) {
  const response = await updateSession(request)

  const supabase = createServerClient(
    process.env.SUPABASE_SERVICE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  const siteOrigin = resolvePublicOrigin(request)

  // 未登录 + 受保护路由 → 跳转登录页，携带原始路径
  if (!user && !isPublic) {
    const loginUrl = new URL('/login', siteOrigin)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 已登录 + 访问登录页 → 跳转首页
  if (user && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', siteOrigin))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}