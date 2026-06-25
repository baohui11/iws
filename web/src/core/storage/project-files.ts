import { BusinessError } from '@/core/errors'
import { getProjectFilesBucket } from '@/core/storage/buckets'
import { storage } from '@/core/storage/storage'

/** 项目文件：解密后的 Buffer 写入项目 bucket */
export async function uploadProjectFileBuffer(params: {
  objectPath: string
  body: Buffer
  contentType: string
}): Promise<void> {
  await storage.put({
    bucket: getProjectFilesBucket(),
    key: params.objectPath,
    body: params.body,
    contentType: params.contentType,
  })
}

export async function createProjectFileSignedUrl(
  storageKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  try {
    return await storage.signedUrl({
      bucket: getProjectFilesBucket(),
      key: storageKey,
      expiresInSec: expiresInSeconds,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '无法生成下载链接'
    throw new BusinessError(msg || '无法生成下载链接')
  }
}
