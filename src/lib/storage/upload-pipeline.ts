import { processFileForUpload } from '@/lib/storage/decrypt'
import { writeWebFileToTempFile } from '@/lib/storage/temp-file'

/**
 * 与头像上传相同的处理链：客户端 File → 写入临时目录 → `processFileForUpload`（解密/预处理占位）→ 得到可上传 Buffer。
 * 临时文件在 finally 中删除；上传方再调用 Storage 上传 Buffer。
 */
export async function decryptClientFileToBuffer(
  file: File,
  extensionForTempFile: string
): Promise<Buffer> {
  const { path, cleanup } = await writeWebFileToTempFile(
    file,
    extensionForTempFile
  )
  try {
    return await processFileForUpload(path)
  } finally {
    await cleanup()
  }
}
