import { randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { and, eq, isNull } from 'drizzle-orm'
import { requireUser } from '@/core/auth'
import { getDb } from '@/core/db/client'
import { contractDeliverables, files, projectMembers, projects } from '@/core/db/schema'
import { BusinessError, ValidationError } from '@/core/errors'
import {
  PROJECT_STAGE_IMPLEMENTATION,
  PROJECT_STAGE_SALES,
  parseProjectStage,
  type ProjectStageValue,
} from '@/constants/project-stage'
import { normalizeSalesFileTag } from '@/constants/sales-file-tags'
import {
  formatMaxProjectFileLabel,
  getMaxProjectFileBytes,
  isAllowedProjectFileExtension,
  PROJECT_FILE_ALLOWED_EXT_HINT,
} from '@/core/storage/constants'
import {
  createProjectFileUploadUrl,
  decryptClientFileToBuffer,
  getProjectFileObjectInfo,
  uploadProjectFileBuffer,
} from '@/core/storage/server'
import {
  DELIVERABLE_FILENAME_RULE_HINT,
  getDeliverableLogicalBaseFromStoredName,
  parseDeliverableFilename,
} from '@/modules/files/lib/deliverable-filename'
import { resolveDeliverableVersionLabelForDb } from '@/modules/files/lib/deliverable-version-label'
import { enqueueInitialProcessingForFile } from '@/modules/files/processing/service'
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

const DIRECT_UPLOAD_TOKEN_MAX_AGE = '15m'
const DIRECT_UPLOAD_URL_EXPIRES_SECONDS = 10 * 60

export interface BeginReferenceFileUploadInput {
  projectId: string
  projectStage: ProjectStageValue
  fileName: string
  fileSize: number
  mimeType?: string | null
  fileSource: FileSourceValue
  isConfidential: boolean
  recommend: boolean
  favorite: boolean
  salesFileTag?: string | null
}

export interface BeginDeliverableFileUploadInput {
  projectId: string
  projectStage: ProjectStageValue
  fileName: string
  fileSize: number
  mimeType?: string | null
  deliverableMode: 'contract' | 'standalone'
  contractDeliverableId?: string
  existingDeliverableFileId?: string
  referenceFileIds?: string[]
  versionLabel?: string
  isConfidential: boolean
  recommend: boolean
  favorite: boolean
}

type DirectUploadTokenPayload =
  | {
      purpose: 'project-file-upload'
      kind: 'reference'
      userId: string
      fileId: string
      projectId: string
      projectStage: ProjectStageValue
      objectPath: string
      fileName: string
      fileSize: number
      fileExt: string | null
      mimeType: string
      fileSource: FileSourceValue
      isConfidential: boolean
      recommend: boolean
      favorite: boolean
      salesFileTag: string | null
    }
  | {
      purpose: 'project-file-upload'
      kind: 'deliverable'
      userId: string
      fileId: string
      projectId: string
      projectStage: ProjectStageValue
      objectPath: string
      fileName: string
      fileSize: number
      fileExt: string | null
      mimeType: string
      deliverableMode: 'contract' | 'standalone'
      contractDeliverableId: string
      existingDeliverableFileId: string
      referenceFileIds: string[]
      versionLabel: string
      isConfidential: boolean
      recommend: boolean
      favorite: boolean
    }

function getUploadTokenSecret(): Uint8Array {
  const raw = process.env.FILE_UPLOAD_TOKEN_SECRET || process.env.AUTH_SECRET
  if (!raw?.trim()) throw new BusinessError('FILE_UPLOAD_TOKEN_SECRET 未配置')
  return new TextEncoder().encode(raw)
}

async function signDirectUploadToken(
  payload: DirectUploadTokenPayload
): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(DIRECT_UPLOAD_TOKEN_MAX_AGE)
    .sign(getUploadTokenSecret())
}

async function verifyDirectUploadToken(
  token: string
): Promise<DirectUploadTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, getUploadTokenSecret())
    if (
      payload.purpose !== 'project-file-upload' ||
      typeof payload.kind !== 'string' ||
      typeof payload.userId !== 'string' ||
      typeof payload.fileId !== 'string' ||
      typeof payload.projectId !== 'string' ||
      typeof payload.objectPath !== 'string' ||
      typeof payload.fileName !== 'string' ||
      typeof payload.fileSize !== 'number' ||
      typeof payload.mimeType !== 'string'
    ) {
      throw new Error('invalid upload token')
    }
    if (payload.kind === 'reference') {
      return {
        purpose: 'project-file-upload',
        kind: 'reference',
        userId: payload.userId,
        fileId: payload.fileId,
        projectId: payload.projectId,
        projectStage: parseProjectStage(String(payload.projectStage)) ?? PROJECT_STAGE_IMPLEMENTATION,
        objectPath: payload.objectPath,
        fileName: payload.fileName,
        fileSize: payload.fileSize,
        fileExt:
          typeof payload.fileExt === 'string' ? payload.fileExt : null,
        mimeType: payload.mimeType,
        fileSource: payload.fileSource as FileSourceValue,
        isConfidential: payload.isConfidential === true,
        recommend: payload.recommend === true,
        favorite: payload.favorite === true,
        salesFileTag:
          typeof payload.salesFileTag === 'string' ? payload.salesFileTag : null,
      }
    }
    if (payload.kind === 'deliverable') {
      return {
        purpose: 'project-file-upload',
        kind: 'deliverable',
        userId: payload.userId,
        fileId: payload.fileId,
        projectId: payload.projectId,
        projectStage: parseProjectStage(String(payload.projectStage)) ?? PROJECT_STAGE_IMPLEMENTATION,
        objectPath: payload.objectPath,
        fileName: payload.fileName,
        fileSize: payload.fileSize,
        fileExt:
          typeof payload.fileExt === 'string' ? payload.fileExt : null,
        mimeType: payload.mimeType,
        deliverableMode:
          payload.deliverableMode === 'standalone' ? 'standalone' : 'contract',
        contractDeliverableId:
          typeof payload.contractDeliverableId === 'string'
            ? payload.contractDeliverableId
            : '',
        existingDeliverableFileId:
          typeof payload.existingDeliverableFileId === 'string'
            ? payload.existingDeliverableFileId
            : '',
        referenceFileIds: Array.isArray(payload.referenceFileIds)
          ? payload.referenceFileIds.filter(
              (v): v is string => typeof v === 'string' && !!v.trim()
            )
          : [],
        versionLabel:
          typeof payload.versionLabel === 'string' ? payload.versionLabel : '',
        isConfidential: payload.isConfidential === true,
        recommend: payload.recommend === true,
        favorite: payload.favorite === true,
      }
    }
  } catch {
    throw new ValidationError('上传令牌无效或已过期')
  }
  throw new ValidationError('上传令牌无效或已过期')
}

function normalizeFileSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError('文件为空')
  }
  const size = Math.trunc(value)
  const maxBytes = getMaxProjectFileBytes()
  if (size > maxBytes) {
    throw new ValidationError(
      `单文件大小不能超过 ${formatMaxProjectFileLabel()}`
    )
  }
  return size
}

function normalizeMimeType(value: string | null | undefined): string {
  const mime = value?.trim()
  return mime || 'application/octet-stream'
}

async function assertUploadedObjectMatches(input: {
  objectPath: string
  fileSize: number
}): Promise<void> {
  const info = await getProjectFileObjectInfo(input.objectPath)
  if (!info) throw new ValidationError('文件尚未上传完成')
  if (info.contentLength !== input.fileSize) {
    throw new ValidationError('上传文件大小与申请信息不一致')
  }
}

async function assertMemberActiveProjectStage(
  userId: string,
  projectId: string,
  projectStage: ProjectStageValue
): Promise<void> {
  const db = getDb()
  const memRows = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.projectStage, projectStage),
        eq(projectMembers.isActive, true),
        isNull(projectMembers.deletedAt)
      )
    )
    .limit(1)

  if (!memRows.length) throw new BusinessError('您不是该项目该阶段成员')

  const projRows = await db
    .select({ is_active: projects.isActive })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  const proj = projRows[0]
  if (!proj?.is_active) {
    throw new BusinessError('仅已激活的项目可上传文件')
  }
}

export async function loadMemberActiveProjectsForFileUpload() {
  const user = await requireUser()
  const projects = await repo.listMemberActiveProjectsForUpload(user.id)
  return { projects }
}

export async function loadFileUploadOptions(
  projectId: string,
  projectStage: ProjectStageValue
) {
  const user = await requireUser()
  const pid = projectId?.trim()
  if (!pid) throw new ValidationError('请选择项目')
  await repo.assertMemberActiveProjectStage(user.id, pid, projectStage)

  const [deliverables, existingDeliverableFiles, referenceFiles] =
    projectStage === PROJECT_STAGE_IMPLEMENTATION
      ? await Promise.all([
          repo.listContractDeliverablesForProject(pid),
          repo.listExistingDeliverableFilesForProject(pid),
          repo.listReferenceFilesForProject(pid, projectStage),
        ])
      : [[], [], []]

  const payload: FileUploadOptionsPayload = {
    deliverables,
    existingDeliverableFiles,
    referenceFiles,
  }
  return payload
}

export async function beginReferenceFileUpload(
  input: BeginReferenceFileUploadInput
) {
  const user = await requireUser()
  const projectId = input.projectId?.trim()
  if (!projectId) throw new ValidationError('请选择项目')
  await assertMemberActiveProjectStage(user.id, projectId, input.projectStage)
  const salesFileTag =
    input.projectStage === PROJECT_STAGE_SALES
      ? normalizeSalesFileTag(input.salesFileTag)
      : null
  if (input.projectStage === PROJECT_STAGE_SALES && !salesFileTag) {
    throw new ValidationError('请选择或填写销售资料标签')
  }

  const allowedSources: FileSourceValue[] = ['client', 'internal', 'public']
  if (!allowedSources.includes(input.fileSource)) {
    throw new ValidationError('请选择文件来源')
  }

  const fileSize = normalizeFileSize(input.fileSize)
  const extLower = fileExtLower(input.fileName)
  if (!isAllowedProjectFileExtension(extLower)) {
    throw new ValidationError(PROJECT_FILE_ALLOWED_EXT_HINT)
  }

  const displayName = getBasenameOnly(input.fileName)
  const dup = await repo.existsReferenceDuplicateName(
    projectId,
    displayName,
    input.projectStage
  )
  if (dup) {
    throw new BusinessError('该项目下已存在同名参考资料，请修改文件名后重试')
  }

  const fileId = randomUUID()
  const objectPath = `${projectId}/reference/${fileId}.${extLower ?? 'bin'}`
  const mimeType = normalizeMimeType(input.mimeType)
  const uploadUrl = await createProjectFileUploadUrl(
    objectPath,
    mimeType,
    DIRECT_UPLOAD_URL_EXPIRES_SECONDS
  )
  const uploadToken = await signDirectUploadToken({
    purpose: 'project-file-upload',
    kind: 'reference',
    userId: user.id,
    fileId,
    projectId,
    projectStage: input.projectStage,
    objectPath,
    fileName: displayName,
    fileSize,
    fileExt: extLower,
    mimeType,
    fileSource: input.fileSource,
    isConfidential: input.isConfidential,
    recommend: input.recommend,
    favorite: input.favorite,
    salesFileTag,
  })

  return {
    fileId,
    objectPath,
    uploadUrl,
    uploadToken,
    expiresInSeconds: DIRECT_UPLOAD_URL_EXPIRES_SECONDS,
  }
}

export async function completeReferenceFileUpload(uploadToken: string) {
  const user = await requireUser()
  const payload = await verifyDirectUploadToken(uploadToken)
  if (payload.kind !== 'reference') throw new ValidationError('上传类型不一致')
  if (payload.userId !== user.id) throw new ValidationError('上传用户不一致')

  await assertMemberActiveProjectStage(user.id, payload.projectId, payload.projectStage)
  await assertUploadedObjectMatches({
    objectPath: payload.objectPath,
    fileSize: payload.fileSize,
  })

  const dup = await repo.existsReferenceDuplicateName(
    payload.projectId,
    payload.fileName,
    payload.projectStage
  )
  if (dup) {
    throw new BusinessError('该项目下已存在同名参考资料，请修改文件名后重试')
  }

  await repo.insertReferenceFileRow({
    id: payload.fileId,
    projectId: payload.projectId,
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    fileExt: payload.fileExt,
    mimeType: payload.mimeType,
    sourceStorageKey: payload.objectPath,
    uploaderId: user.id,
    projectStage: payload.projectStage,
    salesFileTag: payload.salesFileTag,
    fileSource: payload.fileSource,
    isConfidential: payload.isConfidential,
  })

  await repo.insertFileInteractionsForUpload({
    fileId: payload.fileId,
    userId: user.id,
    recommend: payload.recommend,
    favorite: payload.favorite,
  })
  await enqueueInitialProcessingForFile(payload.fileId)

  return { id: payload.fileId }
}

async function prepareDeliverableUpload(input: {
  userId: string
  projectId: string
  projectStage: ProjectStageValue
  fileName: string
  deliverableMode: 'contract' | 'standalone'
  contractDeliverableId: string
  existingDeliverableFileId: string
  referenceFileIds: string[]
  versionLabel: string
}) {
  const projectId = input.projectId?.trim()
  if (!projectId) throw new ValidationError('请选择项目')
  await assertMemberActiveProjectStage(input.userId, projectId, input.projectStage)
  if (input.projectStage !== PROJECT_STAGE_IMPLEMENTATION) {
    throw new ValidationError('成果文件仅支持实施阶段上传')
  }

  const basename = getBasenameOnly(input.fileName)
  const parsed = parseDeliverableFilename(basename)
  if (!parsed) throw new ValidationError(DELIVERABLE_FILENAME_RULE_HINT)

  const extLower = fileExtLower(input.fileName)
  if (!isAllowedProjectFileExtension(extLower)) {
    throw new ValidationError(PROJECT_FILE_ALLOWED_EXT_HINT)
  }

  const extForStorage = parsed.ext ?? extLower ?? 'bin'
  const versionLabelForDb = resolveDeliverableVersionLabelForDb(
    input.versionLabel,
    parsed
  )

  let versionGroupId: string
  let contractDeliverableIdForInsert: string | null
  const fileNameForDb = basename

  if (input.deliverableMode === 'standalone' && input.existingDeliverableFileId) {
    const row = await repo.getDeliverableFileRow(input.existingDeliverableFileId)
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
  } else if (input.deliverableMode === 'contract' && input.contractDeliverableId) {
    const cdName = await repo.getContractDeliverableName(input.contractDeliverableId)
    if (!cdName) throw new ValidationError('合同成果项不存在')

    if (parsed.baseName.trim() !== cdName.trim()) {
      throw new ValidationError(
        `文件的逻辑名「${parsed.baseName.trim()}」须与所选合同成果项名称「${cdName.trim()}」一致`
      )
    }

    const contractProjectId = await repo.getContractDeliverableProjectId(
      input.contractDeliverableId
    )
    if (contractProjectId !== projectId) {
      throw new ValidationError('合同成果与所选项目不一致')
    }

    contractDeliverableIdForInsert = input.contractDeliverableId
    versionGroupId =
      (await repo.findVersionGroupIdForContractDeliverable(
        projectId,
        input.contractDeliverableId
      )) ?? randomUUID()
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

  const refIds = [...new Set(input.referenceFileIds.filter(Boolean))]
  if (refIds.length) {
    for (const rid of refIds) {
      const rf = await repo.getReferenceFileRow(rid)
      if (!rf || rf.project_id !== projectId || rf.is_deliverable) {
        throw new ValidationError('参考文件无效或不属于该项目')
      }
    }
  }

  return {
    projectId,
    fileNameForDb,
    extForStorage,
    versionGroupId,
    versionLabelForDb,
    contractDeliverableIdForInsert,
    referenceFileIds: refIds,
  }
}

export async function beginDeliverableFileUpload(
  input: BeginDeliverableFileUploadInput
) {
  const user = await requireUser()
  const fileSize = normalizeFileSize(input.fileSize)
  const deliverableMode =
    input.deliverableMode === 'standalone' ? 'standalone' : 'contract'
  const referenceFileIds = input.referenceFileIds ?? []
  const prepared = await prepareDeliverableUpload({
    userId: user.id,
    projectId: input.projectId,
    projectStage: input.projectStage,
    fileName: input.fileName,
    deliverableMode,
    contractDeliverableId: input.contractDeliverableId?.trim() ?? '',
    existingDeliverableFileId: input.existingDeliverableFileId?.trim() ?? '',
    referenceFileIds,
    versionLabel: input.versionLabel ?? '',
  })

  const fileId = randomUUID()
  const objectPath = `${prepared.projectId}/deliverable/${fileId}.${prepared.extForStorage}`
  const mimeType = normalizeMimeType(input.mimeType)
  const uploadUrl = await createProjectFileUploadUrl(
    objectPath,
    mimeType,
    DIRECT_UPLOAD_URL_EXPIRES_SECONDS
  )
  const uploadToken = await signDirectUploadToken({
    purpose: 'project-file-upload',
    kind: 'deliverable',
    userId: user.id,
    fileId,
    projectId: prepared.projectId,
    projectStage: PROJECT_STAGE_IMPLEMENTATION,
    objectPath,
    fileName: prepared.fileNameForDb,
    fileSize,
    fileExt: prepared.extForStorage,
    mimeType,
    deliverableMode,
    contractDeliverableId: input.contractDeliverableId?.trim() ?? '',
    existingDeliverableFileId: input.existingDeliverableFileId?.trim() ?? '',
    referenceFileIds: prepared.referenceFileIds,
    versionLabel: input.versionLabel ?? '',
    isConfidential: input.isConfidential,
    recommend: input.recommend,
    favorite: input.favorite,
  })

  return {
    fileId,
    objectPath,
    uploadUrl,
    uploadToken,
    expiresInSeconds: DIRECT_UPLOAD_URL_EXPIRES_SECONDS,
  }
}

export async function completeDeliverableFileUpload(uploadToken: string) {
  const user = await requireUser()
  const payload = await verifyDirectUploadToken(uploadToken)
  if (payload.kind !== 'deliverable') throw new ValidationError('上传类型不一致')
  if (payload.userId !== user.id) throw new ValidationError('上传用户不一致')

  await assertUploadedObjectMatches({
    objectPath: payload.objectPath,
    fileSize: payload.fileSize,
  })

  const prepared = await prepareDeliverableUpload({
    userId: user.id,
    projectId: payload.projectId,
    projectStage: payload.projectStage,
    fileName: payload.fileName,
    deliverableMode: payload.deliverableMode,
    contractDeliverableId: payload.contractDeliverableId,
    existingDeliverableFileId: payload.existingDeliverableFileId,
    referenceFileIds: payload.referenceFileIds,
    versionLabel: payload.versionLabel,
  })

  await repo.markGroupFilesNotLatest(prepared.versionGroupId)
  const versionNo = await repo.getNextVersionNoInGroup(prepared.versionGroupId)

  await repo.insertDeliverableFileRow({
    id: payload.fileId,
    projectId: prepared.projectId,
    fileName: prepared.fileNameForDb,
    fileSize: payload.fileSize,
    fileExt: prepared.extForStorage,
    mimeType: payload.mimeType,
    sourceStorageKey: payload.objectPath,
    uploaderId: user.id,
    projectStage: PROJECT_STAGE_IMPLEMENTATION,
    salesFileTag: null,
    versionGroupId: prepared.versionGroupId,
    versionNo,
    versionLabel: prepared.versionLabelForDb,
    contractDeliverableId: prepared.contractDeliverableIdForInsert,
    fileSource: 'original',
    isConfidential: payload.isConfidential,
  })

  await repo.insertFileReferenceLinks(payload.fileId, prepared.referenceFileIds)

  await repo.insertFileInteractionsForUpload({
    fileId: payload.fileId,
    userId: user.id,
    recommend: payload.recommend,
    favorite: payload.favorite,
  })
  await enqueueInitialProcessingForFile(payload.fileId)

  return { id: payload.fileId }
}

export async function uploadReferenceFile(formData: FormData) {
  const user = await requireUser()
  const projectId = String(formData.get('projectId') ?? '').trim()
  const projectStage =
    parseProjectStage(String(formData.get('projectStage') ?? '')) ??
    PROJECT_STAGE_IMPLEMENTATION
  const sourceRaw = String(formData.get('fileSource') ?? '').trim()
  const salesFileTag =
    projectStage === PROJECT_STAGE_SALES
      ? normalizeSalesFileTag(String(formData.get('salesFileTag') ?? ''))
      : null
  const confidentialRaw = String(formData.get('isConfidential') ?? '')
  const isConfidential = confidentialRaw === 'true' || confidentialRaw === '1'

  if (!projectId) throw new ValidationError('请选择项目')
  await assertMemberActiveProjectStage(user.id, projectId, projectStage)
  if (projectStage === PROJECT_STAGE_SALES && !salesFileTag) {
    throw new ValidationError('请选择或填写销售资料标签')
  }

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
  const dup = await repo.existsReferenceDuplicateName(
    projectId,
    displayName,
    projectStage
  )
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
    projectStage,
    salesFileTag,
    fileSource: sourceRaw,
    isConfidential,
  })

  await repo.insertFileInteractionsForUpload({
    fileId,
    userId: user.id,
    recommend: parseFormBool(formData.get('recommend')),
    favorite: parseFormBool(formData.get('favorite')),
  })
  await enqueueInitialProcessingForFile(fileId)

  return { id: fileId }
}

export async function uploadDeliverableFile(formData: FormData) {
  const user = await requireUser()
  const projectId = String(formData.get('projectId') ?? '').trim()
  const projectStage =
    parseProjectStage(String(formData.get('projectStage') ?? '')) ??
    PROJECT_STAGE_IMPLEMENTATION
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
  await assertMemberActiveProjectStage(user.id, projectId, projectStage)
  if (projectStage !== PROJECT_STAGE_IMPLEMENTATION) {
    throw new ValidationError('成果文件仅支持实施阶段上传')
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
    projectStage: PROJECT_STAGE_IMPLEMENTATION,
    salesFileTag: null,
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
  await enqueueInitialProcessingForFile(fileId)

  return { id: fileId }
}
