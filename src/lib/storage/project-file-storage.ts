import type { SupabaseClient } from '@supabase/supabase-js'
import { BusinessError } from '@/lib/errors'
import { getProjectFilesBucket } from '@/lib/storage/project-file-constants'
import {
  rewriteStorageUrlToPublicOrigin,
  uploadStorageObject,
} from '@/lib/storage/supabase-storage'

/** 项目文件：解密后的 Buffer 写入项目 bucket（与头像共用 `uploadStorageObject`） */
export async function uploadProjectFileBuffer(
  supabase: SupabaseClient,
  params: {
    objectPath: string
    body: Buffer
    contentType: string
  }
): Promise<void> {
  await uploadStorageObject(supabase, {
    bucket: getProjectFilesBucket(),
    objectPath: params.objectPath,
    body: params.body,
    contentType: params.contentType,
    upsert: false,
  })
}

export async function createProjectFileSignedUrl(
  supabase: SupabaseClient,
  storageKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  const bucket = getProjectFilesBucket()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storageKey, expiresInSeconds)
  if (error) {
    throw new BusinessError(error.message || '无法生成下载链接')
  }
  if (!data?.signedUrl) {
    throw new BusinessError('无法生成下载链接')
  }
  return rewriteStorageUrlToPublicOrigin(data.signedUrl)
}
