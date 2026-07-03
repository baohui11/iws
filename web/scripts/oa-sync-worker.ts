import { ensurePgmqQueue } from '../src/core/queue/pgmq'
import {
  OA_SYNC_QUEUE,
  processOaSyncQueueBatch,
} from '../src/modules/oa-sync/queue/queue'

const intervalMs = Number(process.env.OA_SYNC_WORKER_INTERVAL_MS ?? 30_000)
const batchSize = Number(process.env.OA_SYNC_WORKER_BATCH_SIZE ?? 5)

await ensurePgmqQueue(OA_SYNC_QUEUE)

console.log(`[oa-sync-worker] started queue=${OA_SYNC_QUEUE}`)

while (true) {
  try {
    const count = await processOaSyncQueueBatch({ max: batchSize })
    if (count > 0) {
      console.log(`[oa-sync-worker] processed ${count} message(s)`)
    }
  } catch (e) {
    console.error('[oa-sync-worker] batch failed', e)
  }

  await new Promise((resolve) => setTimeout(resolve, intervalMs))
}
