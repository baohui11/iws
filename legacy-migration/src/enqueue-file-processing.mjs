import { HeadObjectCommand } from '../../web/node_modules/@aws-sdk/client-s3/dist-cjs/index.js'
import { loadMigrationEnv, writeReport } from './config.mjs'
import { connectTarget, closeDb } from './db.mjs'
import { assertTargetBuckets, createTargetS3 } from './storage.mjs'

function toInt(value, defaultValue) {
  if (value == null || value === '') return defaultValue
  const n = Number(value)
  if (!Number.isFinite(n)) return defaultValue
  return Math.max(0, Math.trunc(n))
}

function stagesFromEnv() {
  const raw = process.env.FILE_PROCESS_STAGES?.trim() || 'preview,parse'
  const stages = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  const allowed = new Set(['preview', 'parse', 'index', 'embed'])
  for (const stage of stages) {
    if (!allowed.has(stage)) throw new Error(`Invalid stage: ${stage}`)
  }
  return stages
}

async function ensureQueue(target) {
  await target`
    select pgmq.create('file_processing'::text)
    where to_regclass('pgmq.q_file_processing') is null
  `
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

async function enqueueTask(target, fileId, stage, dryRun) {
  if (dryRun) return { status: 'would_enqueue' }

  const priority = stage === 'preview' ? 100 : stage === 'parse' ? 50 : 10
  const rows = await target`
    insert into file_process_tasks (file_id, stage, status, priority, input)
    values (
      ${fileId}::uuid,
      ${stage},
      'pending',
      ${priority},
      '{"version":1}'::jsonb
    )
    on conflict (file_id, stage) do nothing
    returning id
  `
  const taskId = rows[0]?.id
  if (!taskId) return { status: 'skipped_existing_task' }

  const payload = JSON.stringify({ version: 1, taskId, fileId, stage })
  const msgRows = await target`
    select * from pgmq.send('file_processing'::text, ${payload}::jsonb, 0)
  `
  const first = msgRows[0] || {}
  const msgId = first.msg_id || first.send || Object.values(first)[0]
  if (msgId != null) {
    await target`
      update file_process_tasks
      set pgmq_message_id = ${BigInt(msgId)}::bigint, updated_at = now()
      where id = ${taskId}::uuid
    `
  }
  return { status: 'enqueued', taskId, msgId: msgId?.toString?.() ?? null }
}

async function main() {
  const config = loadMigrationEnv()
  const target = connectTarget(config)
  const s3 = createTargetS3(config)
  const limit = toInt(process.env.FILE_PROCESS_ENQUEUE_LIMIT, 20)
  const offset = toInt(process.env.FILE_PROCESS_ENQUEUE_OFFSET, 0)
  const dryRun =
    String(process.env.FILE_PROCESS_ENQUEUE_DRY_RUN ?? 'true').toLowerCase() !==
    'false'
  const requireSourceObject =
    String(process.env.FILE_PROCESS_REQUIRE_SOURCE_OBJECT ?? 'true').toLowerCase() !==
    'false'
  const stages = stagesFromEnv()
  const bucket = config.targetS3.projectFilesBucket

  const report = {
    startedAt: new Date().toISOString(),
    config: {
      limit,
      offset,
      dryRun,
      requireSourceObject,
      stages,
      bucket,
    },
    counts: {
      scanned: 0,
      missingSourceObject: 0,
      wouldEnqueue: 0,
      enqueued: 0,
      skippedExistingTask: 0,
      failed: 0,
    },
    warnings: [],
  }

  try {
    await assertTargetBuckets(config, s3)
    if (!dryRun) await ensureQueue(target)

    const rows =
      limit > 0
        ? await target`
            select id, file_name, source_storage_key
            from files
            where deleted_at is null and source_storage_key is not null
            order by created_at asc, id asc
            offset ${offset}
            limit ${limit}
          `
        : await target`
            select id, file_name, source_storage_key
            from files
            where deleted_at is null and source_storage_key is not null
            order by created_at asc, id asc
            offset ${offset}
          `

    console.log(
      `File processing enqueue: rows=${rows.length}, stages=${stages.join(',')}, dryRun=${dryRun}`
    )

    for (const row of rows) {
      report.counts.scanned += 1
      try {
        if (
          requireSourceObject &&
          !(await objectExists(s3, bucket, row.source_storage_key))
        ) {
          report.counts.missingSourceObject += 1
          report.warnings.push({
            type: 'missing_source_object',
            fileId: row.id,
            fileName: row.file_name,
            key: row.source_storage_key,
          })
          continue
        }

        for (const stage of stages) {
          const result = await enqueueTask(target, row.id, stage, dryRun)
          if (result.status === 'would_enqueue') report.counts.wouldEnqueue += 1
          if (result.status === 'enqueued') report.counts.enqueued += 1
          if (result.status === 'skipped_existing_task') {
            report.counts.skippedExistingTask += 1
          }
        }
      } catch (error) {
        report.counts.failed += 1
        report.warnings.push({
          type: 'enqueue_failed',
          fileId: row.id,
          fileName: row.file_name,
          key: row.source_storage_key,
          message: error?.message ?? String(error),
        })
      }
    }
  } finally {
    await closeDb(target)
  }

  report.finishedAt = new Date().toISOString()
  const reportFile = writeReport(config, 'enqueue-file-processing', report)
  console.log(`Report written: ${reportFile}`)
  console.log(JSON.stringify(report.counts, null, 2))

  if (report.counts.failed > 0) process.exitCode = 1
}

await main()
