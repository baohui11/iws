import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3'

import { getAvatarBucket, getProjectFilesBucket } from '@/core/storage/buckets'
import { getS3 } from '@/core/storage/client'

let ensurePromise: Promise<void> | null = null

async function ensureBucket(bucket: string): Promise<void> {
  const s3 = getS3()
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }))
  }
}

async function ensurePublicRead(bucket: string): Promise<void> {
  const s3 = getS3()
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  }

  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify(policy),
    })
  )
}

export async function ensureStorageBuckets(): Promise<void> {
  ensurePromise ??= (async () => {
    const projectFilesBucket = getProjectFilesBucket()
    const avatarBucket = getAvatarBucket()

    await ensureBucket(projectFilesBucket)
    await ensureBucket(avatarBucket)
    await ensurePublicRead(avatarBucket)
  })()

  return ensurePromise
}
