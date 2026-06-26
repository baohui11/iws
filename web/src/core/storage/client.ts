import { S3Client } from '@aws-sdk/client-s3'

let _s3: S3Client | null = null
let _s3Public: S3Client | null = null

export function createS3Client(endpoint: string): S3Client {
  const client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    // MinIO 需路径风格寻址
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') !== 'false',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
  })

  client.middlewareStack.add(
    (next) => async (args) => {
      const request = args.request as { headers?: Record<string, string> }
      if (request.headers) {
        delete request.headers['x-amz-sdk-checksum-algorithm']
        delete request.headers['x-amz-checksum-crc32']
        delete request.headers['x-amz-checksum-crc32c']
        delete request.headers['x-amz-checksum-sha1']
        delete request.headers['x-amz-checksum-sha256']
      }
      return next(args)
    },
    {
      name: 'stripFlexibleChecksumHeadersForMinio',
      step: 'build',
      priority: 'low',
    }
  )

  return client
}

export function getS3(): S3Client {
  if (_s3) return _s3
  const endpoint = process.env.S3_ENDPOINT
  if (!endpoint) throw new Error('S3_ENDPOINT 未配置')
  _s3 = createS3Client(endpoint)
  return _s3
}

export function getPublicS3(): S3Client {
  if (_s3Public) return _s3Public
  // 浏览器直链签名 URL 用；预览/content 代理须用 getS3()（S3_ENDPOINT）
  const endpoint = process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT
  if (!endpoint) throw new Error('S3_ENDPOINT 未配置')
  _s3Public = createS3Client(endpoint)
  return _s3Public
}
