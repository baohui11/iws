export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return

  try {
    const { ensureStorageBuckets } = await import(
      '@/core/storage/ensure-buckets'
    )
    await ensureStorageBuckets()
  } catch (e) {
    console.warn('[storage] bucket initialization skipped', e)
  }

  try {
    const { ensurePgmqQueue } = await import('@/core/queue/pgmq')
    const { FILE_PROCESSING_QUEUE } = await import(
      '@/modules/files/processing/types'
    )
    const { OA_SYNC_QUEUE } = await import('@/modules/oa-sync/queue/queue')
    await ensurePgmqQueue(FILE_PROCESSING_QUEUE)
    await ensurePgmqQueue(OA_SYNC_QUEUE)
  } catch (e) {
    console.warn('[queue] pgmq initialization skipped', e)
  }
}
