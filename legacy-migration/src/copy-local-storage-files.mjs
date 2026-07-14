import fs from 'node:fs'
import path from 'node:path'
import { HeadObjectCommand } from '../../web/node_modules/@aws-sdk/client-s3/dist-cjs/index.js'
import { loadMigrationEnv, writeReport } from './config.mjs'
import { connectTarget, closeDb } from './db.mjs'
import { assertTargetBuckets, createTargetS3, uploadFileToS3 } from './storage.mjs'

function toInt(value, defaultValue) {
  if (value == null || value === '') return defaultValue
  const n = Number(value)
  if (!Number.isFinite(n)) return defaultValue
  return Math.max(0, Math.trunc(n))
}

function resolveLocalObjectFile(root, bucket, key) {
  const dir = path.resolve(root, bucket, ...key.split('/'))
  if (!fs.existsSync(dir)) {
    return { ok: false, reason: 'missing_directory', dir }
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile())
  if (files.length === 0) {
    return { ok: false, reason: 'empty_directory', dir }
  }
  if (files.length > 1) {
    return {
      ok: false,
      reason: 'multiple_files',
      dir,
      files: files.map((entry) => entry.name),
    }
  }
  return { ok: true, dir, file: path.join(dir, files[0].name) }
}

async function objectExists(s3, bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode
    if (status === 404 || error?.name === 'NotFound') return false
    throw error
  }
}

async function main() {
  const config = loadMigrationEnv()
  const target = connectTarget(config)
  const s3 = createTargetS3(config)
  const limit = toInt(process.env.LOCAL_STORAGE_COPY_LIMIT, 20)
  const offset = toInt(process.env.LOCAL_STORAGE_COPY_OFFSET, 0)
  const dryRun = String(process.env.LOCAL_STORAGE_COPY_DRY_RUN ?? 'true').toLowerCase() !== 'false'
  const onlyMissing = String(process.env.LOCAL_STORAGE_COPY_ONLY_MISSING ?? 'true').toLowerCase() !== 'false'
  const bucket = config.targetS3.projectFilesBucket

  const report = {
    startedAt: new Date().toISOString(),
    config: {
      localStorageRoot: config.localStorageRoot,
      bucket,
      limit,
      offset,
      dryRun,
      onlyMissing,
    },
    counts: {
      scanned: 0,
      skippedExisting: 0,
      uploaded: 0,
      wouldUpload: 0,
      failed: 0,
    },
    warnings: [],
  }

  try {
    await assertTargetBuckets(config, s3)
    const rows =
      limit > 0
        ? await target`
            select
              id,
              file_name,
              mime_type,
              source_storage_key
            from files
            where deleted_at is null and source_storage_key is not null
            order by created_at asc, id asc
            offset ${offset}
            limit ${limit}
          `
        : await target`
            select
              id,
              file_name,
              mime_type,
              source_storage_key
            from files
            where deleted_at is null and source_storage_key is not null
            order by created_at asc, id asc
            offset ${offset}
          `

    console.log(
      `Local storage copy: rows=${rows.length}, dryRun=${dryRun}, root=${config.localStorageRoot}`
    )

    for (const row of rows) {
      report.counts.scanned += 1
      const key = row.source_storage_key
      try {
        if (onlyMissing && await objectExists(s3, bucket, key)) {
          report.counts.skippedExisting += 1
          continue
        }

        const local = resolveLocalObjectFile(config.localStorageRoot, bucket, key)
        if (!local.ok) {
          report.counts.failed += 1
          report.warnings.push({
            type: 'local_object_missing',
            fileId: row.id,
            fileName: row.file_name,
            key,
            ...local,
          })
          continue
        }

        const size = fs.statSync(local.file).size
        if (dryRun) {
          report.counts.wouldUpload += 1
          console.log(`[dry-run] ${key} <= ${local.file} (${size})`)
          continue
        }

        await uploadFileToS3(s3, bucket, key, local.file, row.mime_type)
        report.counts.uploaded += 1
        console.log(`[uploaded] ${key} (${size})`)
      } catch (error) {
        report.counts.failed += 1
        report.warnings.push({
          type: 'local_object_copy_failed',
          fileId: row.id,
          fileName: row.file_name,
          key,
          message: error?.message ?? String(error),
        })
      }
    }
  } finally {
    await closeDb(target)
  }

  report.finishedAt = new Date().toISOString()
  const reportFile = writeReport(config, 'copy-local-storage-files', report)
  console.log(`Report written: ${reportFile}`)
  console.log(JSON.stringify(report.counts, null, 2))

  if (report.counts.failed > 0) process.exitCode = 1
}

await main()
