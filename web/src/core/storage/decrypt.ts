import { readFile } from 'node:fs/promises'

import {
  encryptClient,
  isEncryptSystemConfigured,
} from '@/core/encryption/encrypt-client'

/**
 * 从临时文件读取，经「加密系统」原地解密后得到可上传内容（与 `IWS_TEMP_DIR` 同盘共享路径）。
 * 未配置 `IWS_ENCRYPT_*` 时直接读取原文件，便于本地开发。
 */
export async function processFileForUpload(tempPath: string): Promise<Buffer> {
  if (isEncryptSystemConfigured()) {
    await encryptClient.decryptFile(tempPath)
  }
  return readFile(tempPath)
}

/**
 * 下载前：对临时文件原地加密后，再读取为给用户下载的内容。
 * 未配置 `IWS_ENCRYPT_*` 时直接读取原文件。
 */
export async function processFileForDownload(tempPath: string): Promise<Buffer> {
  if (isEncryptSystemConfigured()) {
    await encryptClient.encryptFile(tempPath)
  }
  return readFile(tempPath)
}
