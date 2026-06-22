import type { SupabaseClient } from '@supabase/supabase-js'
import { BusinessError } from '@/lib/errors'
import { AVATAR_BUCKET } from './constants'

/**
 * 服务端若用 `SUPABASE_SERVICE_URL`，Storage API 返回的 URL 会带内网 origin；
 * 写入 DB 或给浏览器用时需换成 `NEXT_PUBLIC_SUPABASE_URL`。
 */
export function rewriteStorageUrlToPublicOrigin(url: string): string {
  const publicBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!publicBase) return url
  try {
    const parsed = new URL(url)
    const withScheme = /^https?:\/\//i.test(publicBase)
      ? publicBase
      : `http://${publicBase}`
    const pub = new URL(withScheme)
    if (parsed.origin === pub.origin) return url
    return `${pub.origin}${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

/**
 * 通用：上传 Buffer 到指定 bucket（头像、项目文件等共用）。
 */
export async function uploadStorageObject(
  supabase: SupabaseClient,
  params: {
    bucket: string
    objectPath: string
    body: Buffer
    contentType: string
    upsert?: boolean
  }
): Promise<void> {
  const { error } = await supabase.storage
    .from(params.bucket)
    .upload(params.objectPath, params.body, {
      contentType: params.contentType,
      upsert: params.upsert ?? false,
    })

  if (error) {
    throw new BusinessError(error.message || '文件上传失败')
  }
}

export async function uploadAvatarObject(
  supabase: SupabaseClient,
  params: { path: string; body: Buffer; contentType: string }
): Promise<void> {
  await uploadStorageObject(supabase, {
    bucket: AVATAR_BUCKET,
    objectPath: params.path,
    body: params.body,
    contentType: params.contentType,
    upsert: true,
  })
}
