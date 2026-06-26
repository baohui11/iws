/**
 * 对象存储端口。实现：当前 Supabase Storage（适配器），目标 MinIO / S3（+加密网关）。
 * 业务层只依赖此接口，对底层与加密无感。
 */

export interface PutObjectInput {
  bucket: string
  key: string
  body: Buffer | Uint8Array
  contentType: string
  /** 已存在时是否覆盖，默认 false */
  upsert?: boolean
}

export interface ObjectRef {
  bucket: string
  key: string
}

export interface SignedUrlInput extends ObjectRef {
  /** 链接有效期（秒），默认由实现决定 */
  expiresInSec?: number
  responseContentDisposition?: string
  responseContentType?: string
}

export interface SignedPutUrlInput extends ObjectRef {
  contentType: string
  expiresInSec?: number
}

export interface ObjectInfo {
  contentLength: number | null
  contentType: string | null
}

export interface StoragePort {
  put(input: PutObjectInput): Promise<void>
  get(input: ObjectRef): Promise<Buffer>
  signedUrl(input: SignedUrlInput): Promise<string>
  signedPutUrl(input: SignedPutUrlInput): Promise<string>
  head(input: ObjectRef): Promise<ObjectInfo | null>
  remove(input: ObjectRef): Promise<void>
  exists(input: ObjectRef): Promise<boolean>
}
