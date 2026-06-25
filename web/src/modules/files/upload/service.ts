import { randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { requireUser } from '@/core/auth'
import { getDb } from '@/core/db/client'
import { contractDeliverables, files, projectMembers, projects } from '@/core/db/schema'
import { BusinessError, ValidationError } from '@/core/errors'
import {
  formatMaxProjectFileLabel,
  getMaxProjectFileBytes,
  isAllowedProjectFileExtension,
  PROJECT_FILE_ALLOWED_EXT_HINT,
} from '@/core/storage/constants'
import {
  decryptClientFileToBuffer,
  uploadProjectFileBuffer,
} from '@/core/storage/server'
import {
  DELIVERABLE_FILENAME_RULE_HINT,
  getDeliverableLogicalBaseFromStoredName,
  parseDeliverableFilename,
} from '@/modules/files/lib/deliverable-filename'
import { resolveDeliverableVersionLabelForDb } from '@/modules/files/lib/deliverable-version-label'
import {
  fileExtLower,
  getBasenameOnly,
} from '@/modules/files/lib/safe-upload-filename'
import * as repo from './repo'
import type { FileSourceValue, FileUploadOptionsPayload } from '../types'

function parseFormBool(v: FormDataEntryValue | null): boolean {
  const s = String(v ?? '')
    .trim()
    .toLowerCase()
  return s === 'true' || s === '1' || s === 'on'
}

async function assertMemberActiveProject(
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
  if (proj?.project_status !== 'active') {
    throw new BusinessError('仅「进行中」的项目可上传文件')
  }
}

export async function loadMemberActiveProjectsForFileUpload() {
  const user = await requireUser()
  const projects = await repo.listMemberActiveProjectsForUpload(user.id)
  return { projects }
}

export async function loadFileUploadOptions(projectId: string) {
  const user = await requireUser()
  const pid = projectId?.trim()
  if (!pid) throw new ValidationError('请选择项目')
  await assertMemberActiveProject(user.id, pid)

  const [deliverables, existingDeliverableFiles, referenceFiles] =
    await Promise.all([
      repo.listContractDeliverablesForProject(pid),
      repo.listExistingDeliverableFilesForProject(pid),
      repo.listReferenceFilesForProject(pid),
    ])

  const payload: FileUploadOptionsPayload = {
    deliverables,
    existingDeliverableFiles,
    referenceFiles,
  }
  return payload
}

export async function uploadReferenceFile(formData: FormData) {
  const user = await requireUser()
  const projectId = String(formData.get('projectId') ?? '').trim()
  const sourceRaw = String(formData.get('fileSource') ?? '').trim()
  const confidentialRaw = String(formData.get('isConfidential') ?? '')
  const isConfidential = confidentialRaw === 'true' || confidentialRaw === '1'

  if (!projectId) throw new ValidationError('请选择项目')
  await assertMemberActiveProject(user.id, projectId)

  const allowedSources: FileSourceValue[] = ['client', 'internal', 'public']
  if (!allowedSources.includes(sourceRaw as FileSourceValue)) {
    throw new ValidationError('请选择文件来源')
  }

  const raw = formData.get('file')
  if (!raw || typeof raw !== 'object' || !('arrayBuffer' in raw)) {
    throw new ValidationError('请选择要上传的文件')
  }
  const file = raw as File

  const maxBytes = getMaxProjectFileBytes()
  if (file.size > maxBytes) {
    throw new ValidationError(
      `单文件大小不能超过 ${formatMaxProjectFileLabel()}`
    )
  }
  if (file.size <= 0) throw new ValidationError('文件为空')

  const extLower = fileExtLower(file.name)
  if (!isAllowedProjectFileExtension(extLower)) {
    throw new ValidationError(PROJECT_FILE_ALLOWED_EXT_HINT)
  }

  const displayName = getBasenameOnly(file.name)
  const dup = await repo.existsReferenceDuplicateName(projectId, displayName)
  if (dup) {
    throw new BusinessError('该项目下已存在同名参考资料，请修改文件名后重试')
  }

  const mime = file.type?.trim() || 'application/octet-stream'
  const extForTemp = extLower ?? 'bin'
  const processed = await decryptClientFileToBuffer(file, extForTemp)
  if (processed.length === 0) throw new ValidationError('处理后的文件为空')

  const fileId = randomUUID()
  const objectPath = `${projectId}/reference/${fileId}.${extLower ?? 'bin'}`

  await uploadProjectFileBuffer({
    objectPath,
    body: processed,
    contentType: mime,
  })

  await repo.insertReferenceFileRow({
    id: fileId,
    projectId,
    fileName: displayName,
    fileSize: processed.length,
    fileExt: extLower,
    mimeType: mime,
    sourceStorageKey: objectPath,
    uploaderId: user.id,
    fileSource: sourceRaw,
    isConfidential,
  })

  await repo.insertFileInteractionsForUpload({
    fileId,
    userId: user.id,
    recommend: parseFormBool(formData.get('recommend')),
    favorite: parseFormBool(formData.get('favorite')),
  })

  return { id: fileId }
}

export async function uploadDeliverableFile(formData: FormData) {
  const user = await requireUser()
  const projectId = String(formData.get('projectId') ?? '').trim()
  const deliverableMode = String(
    formData.get('deliverableMode') ?? 'contract'
  ).trim()
  const contractDeliverableId = String(
    formData.get('contractDeliverableId') ?? ''
  ).trim()
  const existingDeliverableFileId = String(
    formData.get('existingDeliverableFileId') ?? ''
  ).trim()
  const referenceIdsRaw = String(formData.get('referenceFileIds') ?? '').trim()
  const confidentialRaw = String(formData.get('isConfidential') ?? '')
  const isConfidential = confidentialRaw === 'true' || confidentialRaw === '1'

  if (!projectId) throw new ValidationError('请选择项目')
  await assertMemberActiveProject(user.id, projectId)

  const raw = formData.get('file')
  if (!raw || typeof raw !== 'object' || !('arrayBuffer' in raw)) {
    throw new ValidationError('请选择要上传的文件')
  }
  const file = raw as File

  const maxBytes = getMaxProjectFileBytes()
  if (file.size > maxBytes) {
    throw new ValidationError(
      `单文件大小不能超过 ${formatMaxProjectFileLabel()}`
    )
  }
  if (file.size <= 0) throw new ValidationError('文件为空')

  const extLower = fileExtLower(file.name)
  if (!isAllowedProjectFileExtension(extLower)) {
    throw new ValidationError(PROJECT_FILE_ALLOWED_EXT_HINT)
  }

  const basename = getBasenameOnly(file.name)
  const parsed = parseDeliverableFilename(basename)
  const versionLabelRaw = String(formData.get('versionLabel') ?? '')
  if (!parsed) {
    throw new ValidationError(DELIVERABLE_FILENAME_RULE_HINT)
  }
  const extForStorage = parsed.ext ?? extLower ?? 'bin'
  const versionLabelForDb = resolveDeliverableVersionLabelForDb(
    versionLabelRaw,
    parsed
  )

  let versionGroupId: string
  let contractDeliverableIdForInsert: string | null
  const fileNameForDb = basename

  if (deliverableMode === 'standalone' && existingDeliverableFileId) {
    const row = await repo.getDeliverableFileRow(existingDeliverableFileId)
    if (!row || row.project_id !== projectId) {
      throw new ValidationError('所选成果无效或不属于该项目')
    }
    if (!row.is_deliverable) {
      throw new ValidationError('所选记录不是成果文件')
    }
    if (!row.is_latest) {
      throw new ValidationError('请选择该成果的最新版本')
    }
    if (row.contract_deliverable_id !== null) {
      throw new ValidationError('请选择非合同成果的最新版本')
    }
    const linkedLogical = row.file_name
      ? getDeliverableLogicalBaseFromStoredName(row.file_name)
      : null
    if (!linkedLogical) {
      throw new ValidationError(
        '无法从已关联成果解析逻辑名，请更换关联项或联系管理员'
      )
    }
    if (parsed.baseName.trim() !== linkedLogical) {
      throw new ValidationError(
        `文件的逻辑名「${parsed.baseName.trim()}」须与所关联非合同成果的逻辑名「${linkedLogical}」一致`
      )
    }
    versionGroupId = row.version_group_id
    contractDeliverableIdForInsert = null
  } else if (deliverableMode === 'contract' && contractDeliverableId) {
    const cdName = await repo.getContractDeliverableName(contractDeliverableId)
    if (!cdName) throw new ValidationError('合同成果项不存在')

    if (parsed.baseName.trim() !== cdName.trim()) {
      throw new ValidationError(
        `文件的逻辑名「${parsed.baseName.trim()}」须与所选合同成果项名称「${cdName.trim()}」一致`
      )
    }

    const db = getDb()
    const cdRows = await db
      .select({ project_id: contractDeliverables.projectId })
      .from(contractDeliverables)
      .where(eq(contractDeliverables.id, contractDeliverableId))
      .limit(1)

    const cdRow = cdRows[0]
    if (!cdRow) throw new BusinessError('校验合同成果失败')
    if (cdRow.project_id !== projectId) {
      throw new ValidationError('合同成果与所选项目不一致')
    }

    contractDeliverableIdForInsert = contractDeliverableId

    const firstRows = await db
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

    versionGroupId = firstRows[0]?.version_group_id ?? randomUUID()
  } else {
    versionGroupId = randomUUID()
    contractDeliverableIdForInsert = null
  }

  const hasDup = await repo.existsDeliverableVersionInGroup(
    versionGroupId,
    versionLabelForDb
  )
  if (hasDup) {
    throw new BusinessError(
      '该项目下已存在相同合同成果与相同版本号，请修改文件名中的版本后重试'
    )
  }

  await repo.markGroupFilesNotLatest(versionGroupId)
  const versionNo = await repo.getNextVersionNoInGroup(versionGroupId)

  const fileId = randomUUID()
  const objectPath = `${projectId}/deliverable/${versionGroupId}/${fileId}.${extForStorage}`

  const mime = file.type?.trim() || 'application/octet-stream'
  const extForTemp = extLower ?? 'bin'
  const processed = await decryptClientFileToBuffer(file, extForTemp)
  if (processed.length === 0) throw new ValidationError('处理后的文件为空')

  await uploadProjectFileBuffer({
    objectPath,
    body: processed,
    contentType: mime,
  })

  await repo.insertDeliverableFileRow({
    id: fileId,
    projectId,
    fileName: fileNameForDb,
    fileSize: processed.length,
    fileExt: extForStorage,
    mimeType: mime,
    sourceStorageKey: objectPath,
    uploaderId: user.id,
    versionGroupId,
    versionNo,
    versionLabel: versionLabelForDb,
    contractDeliverableId: contractDeliverableIdForInsert,
    fileSource: 'original',
    isConfidential,
  })

  const refIds = referenceIdsRaw
    ? referenceIdsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  if (refIds.length) {
    const db = getDb()
    for (const rid of refIds) {
      const rfRows = await db
        .select({
          project_id: files.projectId,
          is_deliverable: files.isDeliverable,
        })
        .from(files)
        .where(eq(files.id, rid))
        .limit(1)

      const rf = rfRows[0]
      if (!rf || rf.project_id !== projectId || rf.is_deliverable) {
        throw new ValidationError('参考文件无效或不属于该项目')
      }
    }
  }

  await repo.insertFileReferenceLinks(fileId, refIds)

  await repo.insertFileInteractionsForUpload({
    fileId,
    userId: user.id,
    recommend: parseFormBool(formData.get('recommend')),
    favorite: parseFormBool(formData.get('favorite')),
  })

  return { id: fileId }
}
