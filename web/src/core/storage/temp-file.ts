import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const PREFIX = 'iws-upload-'

/**
 * 临时上传目录（环境变量 `IWS_TEMP_DIR`）：
 * - 未设置：回退为 `os.tmpdir()/iws`（如 Windows `%TEMP%\iws`）
 * - 以 `@` 开头：相对**项目根**（`process.cwd()`），例如 `@temp` → `<cwd>/temp`
 * - 其他相对路径：相对项目根；绝对路径则原样使用
 */
export function resolveTempUploadDir(): string {
  const raw = process.env.IWS_TEMP_DIR?.trim()
  if (!raw) return join(tmpdir(), 'iws')
  if (raw.startsWith('@')) {
    const rest = raw.slice(1) || 'temp'
    return join(process.cwd(), rest)
  }
  if (isAbsolute(raw)) return raw
  return join(process.cwd(), raw)
}

/** 仅允许简单扩展名，避免路径注入 */
function safeFileExtension(ext: string): string {
  const e = ext.replace(/^\./, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return e.length > 0 ? e : 'bin'
}

/**
 * 将内容写入临时目录，供后续解密/处理；处理完成后务必调用 cleanup 删除临时文件。
 *
 * @param extension 不含点，如 `jpg`、`png`；默认 `bin` 表示未区分类型时的通用二进制名。
 */
export async function writeTempFile(
  buffer: Buffer,
  extension: string = 'bin',
): Promise<{
  path: string
  cleanup: () => Promise<void>
}> {
  const dir = resolveTempUploadDir()
  await mkdir(dir, { recursive: true })
  const ext = safeFileExtension(extension)
  const path = join(dir, `${PREFIX}${randomUUID()}.${ext}`)
  await writeFile(path, buffer)

  const cleanup = async () => {
    try {
      await unlink(path)
    } catch {
      // 已删除或不存在时忽略
    }
  }

  return { path, cleanup }
}

/**
 * 将浏览器 File 流式写入临时文件（与 `writeTempFile(Buffer)` 共用目录与命名规则），
 * 供后续 `processFileForUpload` 解密/处理；大文件可避免先整包 `arrayBuffer`。
 */
export async function writeWebFileToTempFile(
  file: File,
  extension: string = 'bin'
): Promise<{
  path: string
  cleanup: () => Promise<void>
}> {
  const dir = resolveTempUploadDir()
  await mkdir(dir, { recursive: true })
  const ext = safeFileExtension(extension)
  const path = join(dir, `${PREFIX}${randomUUID()}.${ext}`)
  const nodeReadable = Readable.fromWeb(
    file.stream() as import('stream/web').ReadableStream
  )
  await pipeline(nodeReadable, createWriteStream(path))

  const cleanup = async () => {
    try {
      await unlink(path)
    } catch {
      // 已删除或不存在时忽略
    }
  }

  return { path, cleanup }
}
