import { writeTempFile } from '@/core/storage/temp-file'
import { processFileForDownload } from '@/core/storage/decrypt'

/**
 * 与上传链对称：Storage 字节 → 写入临时目录 → `processFileForDownload`（加密占位）→ 返回给用户下载的 Buffer。
 */
export async function prepareDownloadBuffer(
  storageBytes: Uint8Array,
  extension: string
): Promise<Buffer> {
  const { path, cleanup } = await writeTempFile(
    Buffer.from(storageBytes),
    extension
  )
  try {
    return await processFileForDownload(path)
  } finally {
    await cleanup()
  }
}
