import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { StoragePort } from '@/core/ports'
import { BusinessError } from '@/core/errors'
import { getS3 } from './client'

/** StoragePort 的 MinIO/S3 实现。 */
export const storage: StoragePort = {
  async put({ bucket, key, body, contentType }) {
    await getS3().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.isBuffer(body) ? body : Buffer.from(body),
        ContentType: contentType,
      })
    )
  },

  async get({ bucket, key }) {
    const res = await getS3().send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    )
    if (!res.Body) throw new BusinessError('对象不存在')
    const bytes = await res.Body.transformToByteArray()
    return Buffer.from(bytes)
  },

  async signedUrl({ bucket, key, expiresInSec = 300 }) {
    return getSignedUrl(
      getS3(),
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: expiresInSec }
    )
  },

  async remove({ bucket, key }) {
    await getS3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  },

  async exists({ bucket, key }) {
    try {
      await getS3().send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      return true
    } catch {
      return false
    }
  },
}
