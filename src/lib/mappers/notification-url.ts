import type { Json } from '@/types/database'

/**
 * 从 meta 解析跳转地址。当前通用约定：meta 为对象且含 url 字符串。
 * 后续可按 type 分支实现不同解析逻辑。
 */
export function parseNotificationUrlFromMeta(
  meta: Json,
  type: string,
): string | null {
  void type // 预留：按 type 解析不同 meta 结构
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) {
    return null
  }
  const url = (meta as Record<string, unknown>).url
  if (typeof url === 'string' && url.trim().length > 0) {
    return url.trim()
  }
  return null
}
