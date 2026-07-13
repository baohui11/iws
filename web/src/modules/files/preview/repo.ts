import { and, desc, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import {
  contractDeliverables,
  departments,
  fileChunks,
  fileProcessTasks,
  files,
  projects,
  projectMembers,
  users,
} from '@/core/db/schema'
import type { Json } from '@/types/json'
import type {
  FilePreviewChunkRow,
  FilePreviewVersionRow,
  FileRowPreview,
} from '../types'

export async function getFileRowForPreview(
  fileId: string
): Promise<FileRowPreview | null> {
  const db = getDb()
  const rows = await db
    .select({
      id: files.id,
      project_id: files.projectId,
      department_id: files.departmentId,
      project_stage: files.projectStage,
      project_name: projects.projectName,
      project_no: projects.projectNo,
      department_name: departments.name,
      file_name: files.fileName,
      original_file_name: files.originalFileName,
      file_size: files.fileSize,
      file_ext: files.fileExt,
      mime_type: files.mimeType,
      source_storage_key: files.sourceStorageKey,
      preview_storage_key: files.previewStorageKey,
      preview_status: files.previewStatus,
      parse_status: files.parseStatus,
      index_status: files.indexStatus,
      is_confidential: files.isConfidential,
      is_deliverable: files.isDeliverable,
      file_source: files.fileSource,
      sales_file_tag: files.salesFileTag,
      business_type: files.businessType,
      contract_deliverable_name: contractDeliverables.name,
      version_group_id: files.versionGroupId,
      version_no: files.versionNo,
      version_label: files.versionLabel,
      is_latest: files.isLatest,
      created_at: files.createdAt,
      uploader_id: files.uploaderId,
      uploader_name: users.name,
    })
    .from(files)
    .leftJoin(projects, eq(files.projectId, projects.id))
    .leftJoin(departments, eq(files.departmentId, departments.id))
    .leftJoin(
      contractDeliverables,
      eq(files.contractDeliverableId, contractDeliverables.id)
    )
    .leftJoin(users, eq(files.uploaderId, users.id))
    .where(eq(files.id, fileId))
    .limit(1)

  const data = rows[0]
  if (!data) return null

  const uploaderName = data.uploader_name?.trim() || '—'

  return {
    id: data.id,
    project_id: data.project_id,
    department_id: data.department_id,
    project_stage: data.project_stage,
    project_name: data.project_name ?? null,
    project_no: data.project_no ?? null,
    department_name: data.department_name ?? null,
    file_name: data.file_name,
    original_file_name: data.original_file_name ?? null,
    file_size: data.file_size,
    file_ext: data.file_ext ?? null,
    mime_type: data.mime_type ?? null,
    source_storage_key: data.source_storage_key,
    preview_storage_key: data.preview_storage_key ?? null,
    preview_status: data.preview_status ?? null,
    parse_status: data.parse_status ?? null,
    index_status: data.index_status ?? null,
    is_confidential: data.is_confidential === true,
    is_deliverable: data.is_deliverable === true,
    file_source: data.file_source ?? null,
    sales_file_tag: data.sales_file_tag ?? null,
    business_type: data.business_type ?? null,
    contract_deliverable_name: data.contract_deliverable_name ?? null,
    version_group_id: data.version_group_id,
    version_no: data.version_no,
    version_label: data.version_label ?? null,
    is_latest: data.is_latest ?? null,
    created_at:
      data.created_at instanceof Date
        ? data.created_at.toISOString()
        : String(data.created_at),
    uploader_id: data.uploader_id,
    uploader_name: uploaderName,
  }
}

export async function listFileVersionsForPreview(
  versionGroupId: string
): Promise<FilePreviewVersionRow[]> {
  const db = getDb()
  const rows = await db
    .select({
      file_id: files.id,
      file_name: files.fileName,
      version_no: files.versionNo,
      version_label: files.versionLabel,
      is_latest: files.isLatest,
      created_at: files.createdAt,
    })
    .from(files)
    .where(and(eq(files.versionGroupId, versionGroupId), isNull(files.deletedAt)))
    .orderBy(desc(files.versionNo), desc(files.createdAt))

  return rows.map((row) => ({
    fileId: row.file_id,
    fileName: row.file_name,
    versionNo: row.version_no,
    versionLabel: row.version_label ?? null,
    isLatest: row.is_latest ?? null,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }))
}

export async function listFileChunksForPreview(
  fileId: string,
  limit = 50
): Promise<{ chunks: FilePreviewChunkRow[]; total: number }> {
  const db = getDb()
  const rows = await db
    .select({
      id: fileChunks.id,
      chunk_index: fileChunks.chunkIndex,
      content: fileChunks.content,
      page_no: fileChunks.pageNo,
      slide_no: fileChunks.slideNo,
      sheet_name: fileChunks.sheetName,
      row_start: fileChunks.rowStart,
      row_end: fileChunks.rowEnd,
      section_title: fileChunks.sectionTitle,
    })
    .from(fileChunks)
    .where(eq(fileChunks.fileId, fileId))
    .orderBy(fileChunks.chunkIndex)
    .limit(limit)

  const totalRows = await db
    .select({ id: fileChunks.id })
    .from(fileChunks)
    .where(eq(fileChunks.fileId, fileId))

  return {
    chunks: rows.map((row) => ({
      id: row.id,
      chunkIndex: row.chunk_index,
      content: row.content,
      pageNo: row.page_no ?? null,
      slideNo: row.slide_no ?? null,
      sheetName: row.sheet_name ?? null,
      rowStart: row.row_start ?? null,
      rowEnd: row.row_end ?? null,
      sectionTitle: row.section_title ?? null,
    })),
    total: totalRows.length,
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
        eq(projectMembers.isActive, true),
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
