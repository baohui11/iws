import fs from 'node:fs'
import {
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '../../web/node_modules/@aws-sdk/client-s3/dist-cjs/index.js'

export function createTargetS3(config) {
  return new S3Client({
    endpoint: config.targetS3.endpoint,
    region: config.targetS3.region,
    credentials: {
      accessKeyId: config.targetS3.accessKeyId,
      secretAccessKey: config.targetS3.secretAccessKey,
    },
    forcePathStyle: config.targetS3.forcePathStyle,
  })
}

export async function assertTargetBuckets(config, s3) {
  for (const bucket of [config.targetS3.projectFilesBucket, config.targetS3.avatarBucket]) {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
  }
}

export async function uploadFileToS3(s3, bucket, key, file, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(file),
      ContentType: contentType || undefined,
    })
  )
}
