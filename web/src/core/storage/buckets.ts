/** 头像桶（公开读） */
export function getAvatarBucket(): string {
  return process.env.S3_AVATAR_BUCKET?.trim() || 'avatars'
}

/** 项目文件桶（私有，签名 URL 访问） */
export function getProjectFilesBucket(): string {
  return process.env.S3_PROJECT_FILES_BUCKET?.trim() || 'project-files'
}

/**
 * DB `users.avatar_url` 仅存对象路径（如 `userId/uuid.jpg`）。
 * 浏览器统一访问站内代理路由，避免依赖公开桶或加密网关直链。
 */
export function resolveAvatarUrl(
  stored: string | null | undefined
): string | undefined {
  if (stored == null || !String(stored).trim()) return undefined
  const value = String(stored).trim()
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/api/avatars/') ||
    value.startsWith('blob:') ||
    value.startsWith('data:')
  ) {
    return value
  }
  const segments = value
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  if (!segments) return undefined
  return `/api/avatars/${segments}`
}
