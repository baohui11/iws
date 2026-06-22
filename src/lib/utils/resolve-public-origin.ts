import type { NextRequest } from 'next/server'

/**
 * 生成对外可访问的站点 origin（用于 Location 重定向）。
 * 监听 0.0.0.0 时 `request.url` 常为 `http://0.0.0.0:3000/...`，浏览器无法打开，需用环境变量或 Host 头修正。
 *
 * 优先 `SITE_URL`（仅服务端，可随部署变更且不暴露给前端）；兼容旧名 `NEXT_PUBLIC_SITE_URL`。
 */
export function resolvePublicOrigin(request: NextRequest): string {
  const fromEnv = (
    process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL
  )
    ?.trim()
    .replace(/\/$/, '')
  if (fromEnv) return fromEnv

  const xfHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const xfProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const host = xfHost || request.headers.get('host') || ''
  if (host && !host.startsWith('0.0.0.0')) {
    const u = new URL(request.url)
    const proto =
      xfProto ||
      (u.protocol === 'https:' ? 'https' : 'http')
    return `${proto}://${host}`
  }

  const u = new URL(request.url)
  if (u.hostname === '0.0.0.0' || u.hostname === '[::]') {
    const port = u.port || '3000'
    return `http://127.0.0.1:${port}`
  }
  return u.origin
}
