/** Supabase Storage bucket for user avatars（需在 Supabase 中创建并配置策略） */
export const AVATAR_BUCKET = 'avatars'

/** 头像文件最大体积 */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export const AVATAR_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])
