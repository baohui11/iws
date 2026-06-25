import { randomUUID } from 'node:crypto'
import { requireUser } from '@/core/auth'
import { ValidationError } from '@/core/errors'
import { getAvatarBucket, resolveAvatarUrl } from '@/core/storage/buckets'
import {
  AVATAR_ALLOWED_MIME,
  MAX_AVATAR_BYTES,
} from '@/core/storage/constants'
import { storage } from '@/core/storage/server'
import { updateAvatarById } from '@/modules/org/users/repo'

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  return map[mime] ?? 'bin'
}

export async function uploadAvatar(formData: FormData) {
  const user = await requireUser()

  const raw = formData.get('file')
  if (!raw || typeof raw !== 'object' || !('arrayBuffer' in raw)) {
    throw new ValidationError('请选择要上传的文件')
  }

  const file = raw as File
  const mime = file.type || 'application/octet-stream'
  if (!AVATAR_ALLOWED_MIME.has(mime)) {
    throw new ValidationError('仅支持 JPEG、PNG、WebP、GIF 图片')
  }
  if (file.size <= 0) throw new ValidationError('文件为空')
  if (file.size > MAX_AVATAR_BYTES) {
    throw new ValidationError('文件大小不能超过 2MB')
  }

  const ext = extFromMime(mime)
  const body = Buffer.from(await file.arrayBuffer())
  const key = `${user.id}/${randomUUID()}.${ext}`

  await storage.put({
    bucket: getAvatarBucket(),
    key,
    body,
    contentType: mime,
    upsert: true,
  })
  await updateAvatarById(user.id, key)

  const avatarUrl = resolveAvatarUrl(key)
  if (!avatarUrl) throw new ValidationError('无法解析头像访问地址')
  return { avatarUrl }
}
