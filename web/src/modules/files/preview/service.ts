import { requireUser } from '@/core/auth'
import { BusinessError, NotFoundError, ValidationError } from '@/core/errors'
import { getProjectFilesBucket } from '@/core/storage/buckets'
import { storage } from '@/core/storage/server'
import { previewContentUrl } from '@/modules/files/preview/content-type'
import {
  MAX_CSV_COLS,
  MAX_CSV_ROWS,
  MAX_TEXT_PREVIEW_BYTES,
  normalizeExt,
  PREVIEW_EXCEL_EXT,
  resolvePreviewStrategy,
} from '@/modules/files/lib/file-preview-kind'
import { resolveFileAccess } from '@/modules/files/access'
import {
  getFileRowForPreview,
  getLatestPreviewResultData,
  listFileChunksForPreview,
  listFileVersionsForPreview,
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

  const access = await resolveFileAccess(user, {
    id: row.id,
    uploader_id: row.uploader_id,
    project_id: row.project_id,
    project_stage: row.project_stage,
    department_id: row.department_id,
    is_confidential: row.is_confidential,
  })
  if (!access.canViewMetadata) throw new NotFoundError('文件不存在')

  const canPreview = access.canAccessContent
  const [versions, chunkData] = await Promise.all([
    listFileVersionsForPreview(row.version_group_id),
    canPreview
      ? listFileChunksForPreview(id)
      : Promise.resolve({ chunks: [], total: 0 }),
  ])
  const baseInfo = {
    fileId: id,
    fileName: row.file_name,
    originalFileName: row.original_file_name,
    fileSize: row.file_size,
    fileExt: row.file_ext,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    projectId: row.project_id,
    projectName: row.project_name,
    projectNo: row.project_no,
    departmentName: row.department_name,
    projectStage: row.project_stage,
    isConfidential: row.is_confidential,
    isDeliverable: row.is_deliverable,
    fileSource: row.file_source,
    salesFileTag: row.sales_file_tag,
    businessType: row.business_type,
    contractDeliverableName: row.contract_deliverable_name,
    versionGroupId: row.version_group_id,
    versionNo: row.version_no,
    versionLabel: row.version_label,
    isLatest: row.is_latest,
    uploaderName: row.uploader_name,
    viewerName: user.name || user.email || user.id,
    processStatus: {
      preview: row.preview_status,
      parse: row.parse_status,
      index: row.index_status,
    },
    versions,
    chunks: chunkData.chunks,
    chunkTotal: chunkData.total,
  }

  if (!canPreview) {
    return {
      ...baseInfo,
      canPreview: false,
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
  const canUsePreviewJson =
    PREVIEW_EXCEL_EXT.has(ext) || ext === 'csv' || ext === 'tsv'
  const previewData = canUsePreviewJson
    ? await getLatestPreviewResultData(id)
    : null

  const hasExcelJson = !!previewData

  const strategy = resolvePreviewStrategy({
    ext,
    fileSize: row.file_size,
    previewStatus: row.preview_status,
    previewStorageKey: row.preview_storage_key,
    hasExcelJson,
  })

  let payload: FilePreviewPayload

  switch (strategy) {
    case 'image': {
      payload = { kind: 'image', signedUrl: previewContentUrl(id) }
      break
    }
    case 'pdf_source': {
      payload = { kind: 'pdf', signedUrl: previewContentUrl(id) }
      break
    }
    case 'pdf_preview': {
      payload = { kind: 'pdf', signedUrl: previewContentUrl(id, 'preview') }
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
      if (previewData) {
        payload = { kind: 'excel', data: previewData }
        break
      }
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
      if (!previewData) {
        payload = {
          kind: 'unsupported',
          message: '暂无表格解析数据，请稍后再试',
        }
        break
      }
      payload = { kind: 'excel', data: previewData }
      break
    }
    case 'media_video': {
      payload = {
        kind: 'media',
        signedUrl: previewContentUrl(id),
        media: 'video',
      }
      break
    }
    case 'media_audio': {
      payload = {
        kind: 'media',
        signedUrl: previewContentUrl(id),
        media: 'audio',
      }
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
        message:
          row.preview_status === 'failed'
            ? 'PDF 预览生成失败，可先下载原文件查看'
            : 'PDF 预览生成中，请稍后刷新',
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
    ...baseInfo,
    canPreview: true,
    payload,
    interactions,
    recommendStats,
    comments,
  }
}
