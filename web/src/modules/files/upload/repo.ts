import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import {
  contractDeliverables,
  fileInteractions,
  fileReferenceLinks,
  files,
  projectMembers,
  projects,
} from '@/core/db/schema'
import { BusinessError } from '@/core/errors'
import {
  FILE_INTERACTION_USER_ROLE_AT_UPLOAD,
  type ContractDeliverableOption,
  type ExistingDeliverableFileOption,
  type FileInteractionTypeValue,
  type InsertDeliverableFileInput,
  type InsertReferenceFileInput,
  type MemberActiveProjectOption,
  type ReferenceFileOption,
  type FileSourceValue,
} from '../types'

/** 当前用户为成员且项目状态为「进行中」 */
export async function listMemberActiveProjectsForUpload(
  userId: string
): Promise<MemberActiveProjectOption[]> {
  const db = getDb()
  const mems = await db
    .select({ project_id: projectMembers.projectId })
    .from(projectMembers)
    .where(
      and(eq(projectMembers.userId, userId), isNull(projectMembers.deletedAt))
    )

  const ids = [
    ...new Set(
      mems.map((m) => m.project_id).filter((id): id is string => id != null)
    ),
  ]
  if (!ids.length) return []

  const projectRows = await db
    .select({
      id: projects.id,
      project_no: projects.projectNo,
      project_name: projects.projectName,
    })
    .from(projects)
    .where(
      and(
        inArray(projects.id, ids),
        eq(projects.projectStatus, 'active'),
        isNull(projects.deletedAt)
      )
    )
    .orderBy(projects.projectNo)

  return projectRows
}

/** 当前用户为成员且项目状态为「进行中」 */
export async function assertMemberActiveProject(
  userId: string,
  projectId: string
): Promise<void> {
  const db = getDb()
  const memRows = await db
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

  if (!memRows.length) throw new BusinessError('您不是该项目成员')

  const projRows = await db
    .select({ project_status: projects.projectStatus })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  const proj = projRows[0]
  if (!proj || proj.project_status !== 'active') {
    throw new BusinessError('仅「进行中」的项目可上传文件')
  }
}

export async function getContractDeliverableProjectId(
  contractDeliverableId: string
): Promise<string | null> {
  const db = getDb()
  const rows = await db
    .select({ project_id: contractDeliverables.projectId })
    .from(contractDeliverables)
    .where(eq(contractDeliverables.id, contractDeliverableId))
    .limit(1)

  return rows[0]?.project_id ?? null
}

export async function findVersionGroupIdForContractDeliverable(
  projectId: string,
  contractDeliverableId: string
): Promise<string | null> {
  const db = getDb()
  const rows = await db
    .select({ version_group_id: files.versionGroupId })
    .from(files)
    .where(
      and(
        eq(files.projectId, projectId),
        eq(files.contractDeliverableId, contractDeliverableId),
        eq(files.isDeliverable, true)
      )
    )
    .limit(1)

  return rows[0]?.version_group_id ?? null
}

export async function getReferenceFileRow(
  fileId: string
): Promise<{ project_id: string; is_deliverable: boolean } | null> {
  const db = getDb()
  const rows = await db
    .select({
      project_id: files.projectId,
      is_deliverable: files.isDeliverable,
    })
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1)

  const data = rows[0]
  if (!data) return null
  return {
    project_id: data.project_id,
    is_deliverable: data.is_deliverable ?? false,
  }
}

export async function listContractDeliverablesForProject(
  projectId: string
): Promise<ContractDeliverableOption[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: contractDeliverables.id,
      name: contractDeliverables.name,
      description: contractDeliverables.description,
    })
    .from(contractDeliverables)
    .where(eq(contractDeliverables.projectId, projectId))
    .orderBy(contractDeliverables.name)

  return rows
}

export async function listExistingDeliverableFilesForProject(
  projectId: string
): Promise<ExistingDeliverableFileOption[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: files.id,
      file_name: files.fileName,
      version_label: files.versionLabel,
      version_group_id: files.versionGroupId,
      contract_deliverable_id: files.contractDeliverableId,
    })
    .from(files)
    .where(
      and(
        eq(files.projectId, projectId),
        eq(files.isDeliverable, true),
        eq(files.isLatest, true)
      )
    )
    .orderBy(desc(files.createdAt))

  return rows
}

export async function listReferenceFilesForProject(
  projectId: string
): Promise<ReferenceFileOption[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: files.id,
      file_name: files.fileName,
      file_source: files.fileSource,
      created_at: files.createdAt,
    })
    .from(files)
    .where(
      and(
        eq(files.projectId, projectId),
        eq(files.isDeliverable, false),
        eq(files.isLatest, true)
      )
    )
    .orderBy(desc(files.createdAt))

  return rows.map((r) => ({
    id: r.id,
    file_name: r.file_name,
    file_source: r.file_source ?? 'internal',
    created_at:
      r.created_at != null
        ? r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at)
        : '',
  }))
}

export async function getDeliverableFileRow(
  fileId: string
): Promise<{
  version_group_id: string
  contract_deliverable_id: string | null
  project_id: string
  is_latest: boolean
  is_deliverable: boolean
  file_name: string | null
} | null> {
  const db = getDb()
  const rows = await db
    .select({
      version_group_id: files.versionGroupId,
      contract_deliverable_id: files.contractDeliverableId,
      project_id: files.projectId,
      is_latest: files.isLatest,
      is_deliverable: files.isDeliverable,
      file_name: files.fileName,
    })
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1)

  const data = rows[0]
  if (!data) return null
  return {
    version_group_id: data.version_group_id,
    contract_deliverable_id: data.contract_deliverable_id,
    project_id: data.project_id,
    is_latest: data.is_latest ?? false,
    is_deliverable: data.is_deliverable ?? false,
    file_name: data.file_name,
  }
}

/** 同一版本组内是否已有相同 version_label */
export async function existsDeliverableVersionInGroup(
  versionGroupId: string,
  versionLabel: string
): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        eq(files.versionGroupId, versionGroupId),
        eq(files.versionLabel, versionLabel),
        eq(files.isDeliverable, true)
      )
    )
    .limit(1)

  return rows.length > 0
}

/** 项目内参考资料：同名最新一条 */
export async function existsReferenceDuplicateName(
  projectId: string,
  fileName: string
): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .select({ id: files.id })
    .from(files)
    .where(
      and(
        eq(files.projectId, projectId),
        eq(files.fileName, fileName),
        eq(files.isDeliverable, false),
        eq(files.isLatest, true)
      )
    )
    .limit(1)

  return rows.length > 0
}

export async function getNextVersionNoInGroup(
  versionGroupId: string
): Promise<number> {
  const db = getDb()
  const rows = await db
    .select({ version_no: files.versionNo })
    .from(files)
    .where(eq(files.versionGroupId, versionGroupId))
    .orderBy(desc(files.versionNo))
    .limit(1)

  const n = rows[0]?.version_no
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1
  return n + 1
}

export async function markGroupFilesNotLatest(
  versionGroupId: string
): Promise<void> {
  const db = getDb()
  await db
    .update(files)
    .set({ isLatest: false })
    .where(
      and(eq(files.versionGroupId, versionGroupId), eq(files.isLatest, true))
    )
}

export async function insertFileReferenceLinks(
  deliverableFileId: string,
  referenceFileIds: string[]
): Promise<void> {
  const unique = [...new Set(referenceFileIds.filter(Boolean))]
  if (!unique.length) return
  const db = getDb()
  const rows = unique.map((referenceFileId) => ({
    referenceFileId,
    deliverableFileId,
  }))
  await db.insert(fileReferenceLinks).values(rows)
}

export async function insertDeliverableFileRow(
  input: InsertDeliverableFileInput
): Promise<void> {
  const db = getDb()
  await db.insert(files).values({
    id: input.id,
    projectId: input.projectId,
    fileName: input.fileName,
    fileSize: input.fileSize,
    fileExt: input.fileExt,
    mimeType: input.mimeType,
    sourceStorageKey: input.sourceStorageKey,
    uploaderId: input.uploaderId,
    versionGroupId: input.versionGroupId,
    versionNo: input.versionNo,
    versionLabel: input.versionLabel,
    isLatest: true,
    isDeliverable: true,
    contractDeliverableId: input.contractDeliverableId,
    fileSource: input.fileSource as FileSourceValue,
    isConfidential: input.isConfidential,
    previewStatus: 'pending',
    parseStatus: 'pending',
    indexStatus: 'pending',
    processingUpdatedAt: new Date(),
  })
}

export async function insertReferenceFileRow(
  input: InsertReferenceFileInput
): Promise<void> {
  const db = getDb()
  const vg = randomUUID()
  await db.insert(files).values({
    id: input.id,
    projectId: input.projectId,
    fileName: input.fileName,
    fileSize: input.fileSize,
    fileExt: input.fileExt,
    mimeType: input.mimeType,
    sourceStorageKey: input.sourceStorageKey,
    uploaderId: input.uploaderId,
    versionGroupId: vg,
    versionNo: 1,
    versionLabel: null,
    isLatest: true,
    isDeliverable: false,
    contractDeliverableId: null,
    fileSource: input.fileSource as FileSourceValue,
    isConfidential: input.isConfidential,
    previewStatus: 'pending',
    parseStatus: 'pending',
    indexStatus: 'pending',
    processingUpdatedAt: new Date(),
  })
}

export async function getContractDeliverableName(
  id: string
): Promise<string | null> {
  const db = getDb()
  const rows = await db
    .select({ name: contractDeliverables.name })
    .from(contractDeliverables)
    .where(eq(contractDeliverables.id, id))
    .limit(1)

  return rows[0]?.name?.trim() ?? null
}

/**
 * 上传成功后，按勾选写入 file_interactions（每种类型最多一条）。
 * 列：file_id, user_id, interaction_type, user_role_at_time
 */
export async function insertFileInteractionsForUpload(params: {
  fileId: string
  userId: string
  recommend: boolean
  favorite: boolean
}): Promise<void> {
  const rows: Array<{
    fileId: string
    userId: string
    interactionType: FileInteractionTypeValue
    userRoleAtTime: typeof FILE_INTERACTION_USER_ROLE_AT_UPLOAD
  }> = []
  if (params.recommend) {
    rows.push({
      fileId: params.fileId,
      userId: params.userId,
      interactionType: 'recommend',
      userRoleAtTime: FILE_INTERACTION_USER_ROLE_AT_UPLOAD,
    })
  }
  if (params.favorite) {
    rows.push({
      fileId: params.fileId,
      userId: params.userId,
      interactionType: 'favorite',
      userRoleAtTime: FILE_INTERACTION_USER_ROLE_AT_UPLOAD,
    })
  }
  if (rows.length === 0) return

  const db = getDb()
  await db.insert(fileInteractions).values(rows)
}
