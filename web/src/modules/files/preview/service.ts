import { requireUser } from '@/core/auth'
import { BusinessError, NotFoundError, ValidationError } from '@/core/errors'
import { createProjectFileSignedUrl } from '@/core/storage/project-files'
import { getProjectFilesBucket } from '@/core/storage/buckets'
import { storage } from '@/core/storage/server'
import {
  MAX_CSV_COLS,
  MAX_CSV_ROWS,
  MAX_TEXT_PREVIEW_BYTES,
  normalizeExt,
  PREVIEW_EXCEL_EXT,
  resolvePreviewStrategy,
} from '@/modules/files/lib/file-preview-kind'
import { canAccessFileBinary } from '../preview/access'
import {
  getFileRowForPreview,
  getLatestParseResultData,
} from '../preview/repo'
import {
  getFileRecommendStats,
  getUserFileInteractionsForFile,
  listTopLevelFileComments,
} from '../social/repo'
import type { FilePreviewLoadResult, FilePreviewPayload } from '../types'

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

function parseDelimitedRows(
  text: string,
  delimiter: ',' | '\t'
): { rows: string[][]; truncated: boolean } {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  const truncated = lines.length > MAX_CSV_ROWS
  const slice = lines.slice(0, MAX_CSV_ROWS)
  const rows = slice.map((row) => {
    const parts =
      delimiter === '\t'
        ? row.split('\t')
        : row.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    return parts.slice(0, MAX_CSV_COLS)
  })
  return { rows, truncated }
}

async function downloadStorageObject(storageKey: string): Promise<Uint8Array> {
  const bucket = getProjectFilesBucket()
  try {
    const buf = await storage.get({ bucket, key: storageKey })
    return new Uint8Array(buf)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '读取文件失败'
    throw new BusinessError(msg || '读取文件失败')
  }
}

export async function loadFilePreview(
  fileId: string
): Promise<FilePreviewLoadResult> {
  const user = await requireUser()
  const id = fileId?.trim()
  if (!id) throw new ValidationError('文件 ID 无效')

  const row = await getFileRowForPreview(id)
  if (!row) throw new NotFoundError('文件不存在')

  const canPreview = canAccessFileBinary(user, row)
  if (!canPreview) {
    return {
      fileId: id,
      fileName: row.file_name,
      fileSize: row.file_size,
      fileExt: row.file_ext,
      canPreview: false,
      uploaderName: row.uploader_name,
      payload: {
        kind: 'unsupported',
        message:
          '该文件已标记为客户敏感信息，仅上传者及指定管理员可预览。您仍可查看上方文件信息。',
      },
      interactions: { favorite: false, recommend: false },
      recommendStats: { count: 0, sampleUsers: [] },
      comments: [],
    }
  }

  const ext = normalizeExt(row.file_ext)
  const parseData = PREVIEW_EXCEL_EXT.has(ext)
    ? await getLatestParseResultData(id)
    : null

  const hasExcelJson = !!parseData

  const strategy = resolvePreviewStrategy({
    ext,
    fileSize: row.file_size,
    previewStatus: row.preview_status,
    previewStorageKey: row.preview_storage_key,
    hasExcelJson,
  })

  let payload: FilePreviewPayload

  const signedSource = async () =>
    createProjectFileSignedUrl(row.source_storage_key, 3600)

  const signedPreviewPdf = async () => {
    const key = row.preview_storage_key?.trim()
    if (!key) throw new BusinessError('缺少预览文件')
    return createProjectFileSignedUrl(key, 3600)
  }

  switch (strategy) {
    case 'image': {
      const url = await signedSource()
      payload = { kind: 'image', signedUrl: url }
      break
    }
    case 'pdf_source': {
      const url = await signedSource()
      payload = { kind: 'pdf', signedUrl: url }
      break
    }
    case 'pdf_preview': {
      const url = await signedPreviewPdf()
      payload = { kind: 'pdf', signedUrl: url }
      break
    }
    case 'text':
    case 'markdown': {
      if (row.file_size > MAX_TEXT_PREVIEW_BYTES) {
        payload = {
          kind: 'unsupported',
          message: '文件过大，暂不支持在线预览',
        }
        break
      }
      const bytes = await downloadStorageObject(row.source_storage_key)
      const text = decodeUtf8(bytes)
      const isMd = ext === 'md' || ext === 'markdown'
      payload = isMd
        ? { kind: 'markdown', text }
        : { kind: 'text', text }
      break
    }
    case 'csv': {
      if (row.file_size > MAX_TEXT_PREVIEW_BYTES) {
        payload = {
          kind: 'unsupported',
          message: '文件过大，暂不支持在线预览',
        }
        break
      }
      const bytes = await downloadStorageObject(row.source_storage_key)
      const raw = decodeUtf8(bytes)
      const delimiter = ext === 'tsv' ? '\t' : ','
      const { rows, truncated } = parseDelimitedRows(raw, delimiter)
      payload = { kind: 'csv', rows, truncated }
      break
    }
    case 'excel': {
      if (!parseData) {
        payload = {
          kind: 'unsupported',
          message: '暂无表格解析数据，请稍后再试',
        }
        break
      }
      payload = { kind: 'excel', data: parseData }
      break
    }
    case 'media_video': {
      const url = await signedSource()
      payload = { kind: 'media', signedUrl: url, media: 'video' }
      break
    }
    case 'media_audio': {
      const url = await signedSource()
      payload = { kind: 'media', signedUrl: url, media: 'audio' }
      break
    }
    case 'unsupported_large_media': {
      payload = {
        kind: 'unsupported',
        message: '音视频超过 50MB，暂不支持在线播放',
      }
      break
    }
    case 'unsupported_no_pdf': {
      payload = {
        kind: 'unsupported',
        message: '暂无 PDF 预览版本，暂不支持在线预览 Office 文稿',
      }
      break
    }
    default: {
      payload = {
        kind: 'unsupported',
        message: '暂不支持预览该类型文件',
      }
    }
  }

  const interactions = await getUserFileInteractionsForFile(user.id, id)
  const recommendStats = await getFileRecommendStats(id)
  const comments = await listTopLevelFileComments(id)

  return {
    fileId: id,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileExt: row.file_ext,
    canPreview: true,
    uploaderName: row.uploader_name,
    payload,
    interactions,
    recommendStats,
    comments,
  }
}
