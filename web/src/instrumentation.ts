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
    await ensurePgmqQueue(FILE_PROCESSING_QUEUE)
  } catch (e) {
    console.warn('[queue] pgmq initialization skipped', e)
  }
}
