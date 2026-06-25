import { S3Client } from '@aws-sdk/client-s3'

let _s3: S3Client | null = null

export function getS3(): S3Client {
  if (_s3) return _s3
  const endpoint = process.env.S3_ENDPOINT
  if (!endpoint) throw new Error('S3_ENDPOINT 未配置')
  _s3 = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint,
    // MinIO 需路径风格寻址
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') !== 'false',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
  })
  return _s3
}
