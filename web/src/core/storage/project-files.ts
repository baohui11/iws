import { BusinessError } from '@/core/errors'
import { getProjectFilesBucket } from '@/core/storage/buckets'
import { createS3Client, getS3 } from '@/core/storage/client'
import { storage } from '@/core/storage/storage'
import {
  GetObjectCommand,
  HeadObjectCommand,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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
  expiresInSeconds = 3600,
  options?: {
    responseContentDisposition?: string
    responseContentType?: string
  }
): Promise<string> {
  try {
    return await storage.signedUrl({
      bucket: getProjectFilesBucket(),
      key: storageKey,
      expiresInSec: expiresInSeconds,
      responseContentDisposition: options?.responseContentDisposition,
      responseContentType: options?.responseContentType,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '无法生成下载链接'
    throw new BusinessError(msg || '无法生成下载链接')
  }
}

export async function createProjectFileUploadUrl(
  storageKey: string,
  contentType: string,
  expiresInSeconds = 600
): Promise<string> {
  try {
    return await storage.signedPutUrl({
      bucket: getProjectFilesBucket(),
      key: storageKey,
      contentType,
      expiresInSec: expiresInSeconds,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '无法生成上传链接'
    throw new BusinessError(msg || '无法生成上传链接')
  }
}

export async function getProjectFileObjectInfo(storageKey: string) {
  try {
    return await storage.head({
      bucket: getProjectFilesBucket(),
      key: storageKey,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '无法确认上传对象'
    throw new BusinessError(msg || '无法确认上传对象')
  }
}

/** 预览/content 代理：仅用 S3_ENDPOINT 读取元信息，不走 S3_PUBLIC_ENDPOINT */
export async function headProjectFileObjectInternal(storageKey: string) {
  try {
    const res = await getS3().send(
      new HeadObjectCommand({
        Bucket: getProjectFilesBucket(),
        Key: storageKey,
      })
    )
    return {
      contentLength:
        typeof res.ContentLength === 'number' ? res.ContentLength : null,
      contentType: res.ContentType ?? null,
    }
  } catch {
    return null
  }
}

/** 预览/content 代理：仅用 S3_ENDPOINT 拉取对象，不走 S3_PUBLIC_ENDPOINT */
export async function getProjectFileObjectInternal(
  storageKey: string,
  range?: { start: number; end: number }
): Promise<GetObjectCommandOutput> {
  return getS3().send(
    new GetObjectCommand({
      Bucket: getProjectFilesBucket(),
      Key: storageKey,
      ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
    })
  )
}

export async function createProjectFileSignedUrlWithEndpoint(
  storageKey: string,
  endpoint: string,
  expiresInSeconds = 600,
  options?: {
    responseContentDisposition?: string
    responseContentType?: string
  }
): Promise<string> {
  try {
    return await getSignedUrl(
      createS3Client(endpoint),
      new GetObjectCommand({
        Bucket: getProjectFilesBucket(),
        Key: storageKey,
        ResponseContentDisposition: options?.responseContentDisposition,
        ResponseContentType: options?.responseContentType,
      }),
      { expiresIn: expiresInSeconds }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : '无法生成文件链接'
    throw new BusinessError(msg || '无法生成文件链接')
  }
}
