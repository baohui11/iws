import { AVATAR_BUCKET } from '@/lib/storage/constants'

/** DB `users.avatar_url`：仅存 `avatars` bucket 内对象路径，如 `userId/uuid.jpg` */
export function resolveAvatarUrl(
  stored: string | null | undefined,
): string | undefined {
  if (stored == null || !String(stored).trim()) return undefined
  const s = String(stored).trim()
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!base) return undefined
  const withScheme = /^https?:\/\//i.test(base) ? base : `http://${base}`
  let origin: string
  try {
    origin = new URL(withScheme).origin
  } catch {
    return undefined
  }
  const segments = s
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return `${origin}/storage/v1/object/public/${AVATAR_BUCKET}/${segments}`
}
