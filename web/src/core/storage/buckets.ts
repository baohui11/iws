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
 * 头像桶为公开读，直接拼浏览器可访问的 URL（路径风格）。
 */
export function resolveAvatarUrl(
  stored: string | null | undefined
): string | undefined {
  if (stored == null || !String(stored).trim()) return undefined
  const base = (
    process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT
  )?.replace(/\/$/, '')
  if (!base) return undefined
  const segments = String(stored)
    .trim()
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return `${base}/${getAvatarBucket()}/${segments}`
}
