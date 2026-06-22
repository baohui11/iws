'use server'

import { handleAction } from '@/lib/action-handler'
import { AuthError, NotFoundError, ValidationError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import { canAccessFileBinary } from '@/lib/db/files/file-preview-access'
import {
  getFileRowForPreview,
  getLatestParseResultData,
} from '@/lib/db/files/file-preview'
import {
  getFileRecommendStats,
  getUserFileInteractionsForFile,
  listTopLevelFileComments,
} from '@/lib/db/files/file-preview-social'
import { createClient } from '@/lib/supabase/server'
import { createProjectFileSignedUrl } from '@/lib/storage/project-file-storage'
import { getProjectFilesBucket } from '@/lib/storage/project-file-constants'
import {
  MAX_CSV_COLS,
  MAX_CSV_ROWS,
  MAX_TEXT_PREVIEW_BYTES,
  normalizeExt,
  PREVIEW_EXCEL_EXT,
  resolvePreviewStrategy,
} from '@/lib/utils/file-preview-kind'
import type { FilePreviewLoadResult, FilePreviewPayload } from '@/types/file-preview'

async function requireProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AuthError('请先登录')
  const profile = await getProfileById(user.id)
  if (!profile) throw new AuthError('请先登录')
  return profile
}

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

async function downloadStorageObject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storageKey: string
): Promise<Uint8Array> {
  const bucket = getProjectFilesBucket()
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(storageKey)
  if (error) throw new Error(error.message || '读取文件失败')
  const ab = await data.arrayBuffer()
  return new Uint8Array(ab)
}

export async function loadFilePreview(fileId: string) {
  return handleAction(async (): Promise<FilePreviewLoadResult> => {
    const profile = await requireProfile()
    const id = fileId?.trim()
    if (!id) throw new ValidationError('文件 ID 无效')

    const row = await getFileRowForPreview(id)
    if (!row) throw new NotFoundError('文件不存在')

    const canPreview = canAccessFileBinary(profile, row)
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
          message: '该文件已标记为客户敏感信息，仅上传者及指定管理员可预览。您仍可查看上方文件信息。',
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

    const supabase = await createClient()

    const strategy = resolvePreviewStrategy({
      ext,
      fileSize: row.file_size,
      previewStatus: row.preview_status,
      previewStorageKey: row.preview_storage_key,
      hasExcelJson,
    })

    let payload: FilePreviewPayload

    const signedSource = async () =>
      createProjectFileSignedUrl(supabase, row.source_storage_key, 3600)

    const signedPreviewPdf = async () => {
      const key = row.preview_storage_key?.trim()
      if (!key) throw new Error('缺少预览文件')
      return createProjectFileSignedUrl(supabase, key, 3600)
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
        const bytes = await downloadStorageObject(
          supabase,
          row.source_storage_key
        )
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
        const bytes = await downloadStorageObject(
          supabase,
          row.source_storage_key
        )
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

    const interactions = await getUserFileInteractionsForFile(profile.id, id)
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
  })
}
