'use server'

import { randomUUID } from 'node:crypto'

import { handleAction } from '@/lib/action-handler'
import { AuthError, ValidationError } from '@/lib/errors'
import { updateAvatarUrlByAuthId } from '@/lib/db/auth/profile'
import { createClient } from '@/lib/supabase/server'
import {
  AVATAR_ALLOWED_MIME,
  MAX_AVATAR_BYTES,
} from '@/lib/storage/constants'
import { resolveAvatarUrl } from '@/lib/storage/avatar-url'
import { uploadAvatarObject } from '@/lib/storage/supabase-storage'
import { decryptClientFileToBuffer } from '@/lib/storage/upload-pipeline'

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
  return handleAction(async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new AuthError('请先登录')

    const raw = formData.get('file')
    if (!raw || typeof raw !== 'object' || !('arrayBuffer' in raw)) {
      throw new ValidationError('请选择要上传的文件')
    }

    const file = raw as File
    const mime = file.type || 'application/octet-stream'
    if (!AVATAR_ALLOWED_MIME.has(mime)) {
      throw new ValidationError('仅支持 JPEG、PNG、WebP、GIF 图片')
    }

    if (file.size <= 0) {
      throw new ValidationError('文件为空')
    }
    if (file.size > MAX_AVATAR_BYTES) {
      throw new ValidationError('文件大小不能超过 2MB')
    }

    const ext = extFromMime(mime)
    const processed = await decryptClientFileToBuffer(file, ext)
    const objectPath = `${user.id}/${randomUUID()}.${ext}`

    await uploadAvatarObject(supabase, {
      path: objectPath,
      body: processed,
      contentType: mime,
    })

    await updateAvatarUrlByAuthId(user.id, objectPath)
    const avatarUrl = resolveAvatarUrl(objectPath)
    if (!avatarUrl) {
      throw new ValidationError('无法解析头像访问地址')
    }
    return { avatarUrl }
  })
}
