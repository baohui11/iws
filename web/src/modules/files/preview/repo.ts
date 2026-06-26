import { and, desc, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import {
  fileProcessTasks,
  files,
  projectMembers,
  users,
} from '@/core/db/schema'
import type { Json } from '@/types/json'
import type { FileRowPreview } from '../types'

export async function getFileRowForPreview(
  fileId: string
): Promise<FileRowPreview | null> {
  const db = getDb()
  const rows = await db
    .select({
      id: files.id,
      project_id: files.projectId,
      file_name: files.fileName,
      file_size: files.fileSize,
      file_ext: files.fileExt,
      mime_type: files.mimeType,
      source_storage_key: files.sourceStorageKey,
      preview_storage_key: files.previewStorageKey,
      preview_status: files.previewStatus,
      parse_status: files.parseStatus,
      index_status: files.indexStatus,
      is_confidential: files.isConfidential,
      uploader_id: files.uploaderId,
      uploader_name: users.name,
    })
    .from(files)
    .leftJoin(users, eq(files.uploaderId, users.id))
    .where(eq(files.id, fileId))
    .limit(1)

  const data = rows[0]
  if (!data) return null

  const uploaderName = data.uploader_name?.trim() || '—'

  return {
    id: data.id,
    project_id: data.project_id,
    file_name: data.file_name,
    file_size: data.file_size,
    file_ext: data.file_ext ?? null,
    mime_type: data.mime_type ?? null,
    source_storage_key: data.source_storage_key,
    preview_storage_key: data.preview_storage_key ?? null,
    preview_status: data.preview_status ?? null,
    parse_status: data.parse_status ?? null,
    index_status: data.index_status ?? null,
    is_confidential: data.is_confidential === true,
    uploader_id: data.uploader_id,
    uploader_name: uploaderName,
  }
}

/** 当前用户是否为该项目成员（未删除） */
export async function isUserProjectMember(
  userId: string,
  projectId: string
): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.projectId, projectId),
        isNull(projectMembers.deletedAt)
      )
    )
    .limit(1)

  return rows.length > 0
}

/** 取 parse 任务成功时的 result_data（如 Excel 预览 JSON） */
export async function getLatestPreviewResultData(
  fileId: string
): Promise<Json | null> {
  const db = getDb()
  const rows = await db
    .select({ output: fileProcessTasks.output })
    .from(fileProcessTasks)
    .where(
      and(
        eq(fileProcessTasks.fileId, fileId),
        eq(fileProcessTasks.stage, 'preview'),
        eq(fileProcessTasks.status, 'ready')
      )
    )
    .orderBy(desc(fileProcessTasks.completedAt))
    .limit(1)

  const data = rows[0]
  return (data?.output as Json | null) ?? null
}
