'use server'

import { randomUUID } from 'node:crypto'

import { handleAction } from '@/lib/action-handler'
import { AuthError, BusinessError, ValidationError } from '@/lib/errors'
import { getProfileById } from '@/lib/db/auth/profile'
import { insertFileInteractionsForUpload } from '@/lib/db/weekly/file-interactions'
import {
  existsDeliverableVersionInGroup,
  existsReferenceDuplicateName,
  getContractDeliverableName,
  getDeliverableFileRow,
  getNextVersionNoInGroup,
  insertDeliverableFileRow,
  insertFileReferenceLinks,
  insertReferenceFileRow,
  listContractDeliverablesForProject,
  listExistingDeliverableFilesForProject,
  listMemberActiveProjectsForUpload,
  listReferenceFilesForProject,
  markGroupFilesNotLatest,
} from '@/lib/db/weekly/file-upload'
import { createClient } from '@/lib/supabase/server'
import {
  formatMaxProjectFileLabel,
  getMaxProjectFileBytes,
  isAllowedProjectFileExtension,
  PROJECT_FILE_ALLOWED_EXT_HINT,
} from '@/lib/storage/project-file-constants'
import { uploadProjectFileBuffer } from '@/lib/storage/project-file-storage'
import { decryptClientFileToBuffer } from '@/lib/storage/upload-pipeline'
import {
  DELIVERABLE_FILENAME_RULE_HINT,
  getDeliverableLogicalBaseFromStoredName,
  parseDeliverableFilename,
} from '@/lib/utils/deliverable-filename'
import { resolveDeliverableVersionLabelForDb } from '@/lib/utils/deliverable-version-label'
import {
  fileExtLower,
  getBasenameOnly,
} from '@/lib/utils/safe-upload-filename'
import type { FileSourceValue, FileUploadOptionsPayload } from '@/types/file-upload'

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
  const supabase = await createClient()
  const { data: mem, error: e0 } = await supabase
    .from('project_members')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .maybeSingle()
  if (e0) throw new BusinessError('校验项目权限失败')
  if (!mem) throw new BusinessError('您不是该项目成员')

  const { data: proj, error: e1 } = await supabase
    .from('projects')
    .select('project_status')
    .eq('id', projectId)
    .is('deleted_at', null)
    .maybeSingle()
  if (e1) throw new BusinessError('校验项目状态失败')
  if (proj?.project_status !== 'active') {
    throw new BusinessError('仅「进行中」的项目可上传文件')
  }
}

export async function loadMemberActiveProjectsForFileUpload() {
  return handleAction(async () => {
    const profile = await requireProfile()
    const projects = await listMemberActiveProjectsForUpload(profile.id)
    return { projects }
  })
}

export async function loadFileUploadOptions(projectId: string) {
  return handleAction(async () => {
    const profile = await requireProfile()
    const pid = projectId?.trim()
    if (!pid) throw new ValidationError('请选择项目')
    await assertMemberActiveProject(profile.id, pid)

    const [deliverables, existingDeliverableFiles, referenceFiles] =
      await Promise.all([
        listContractDeliverablesForProject(pid),
        listExistingDeliverableFilesForProject(pid),
        listReferenceFilesForProject(pid),
      ])

    const payload: FileUploadOptionsPayload = {
      deliverables,
      existingDeliverableFiles,
      referenceFiles,
    }
    return payload
  })
}

export async function uploadReferenceFileAction(formData: FormData) {
  return handleAction(async () => {
    const profile = await requireProfile()
    const projectId = String(formData.get('projectId') ?? '').trim()
    const sourceRaw = String(formData.get('fileSource') ?? '').trim()
    const confidentialRaw = String(formData.get('isConfidential') ?? '')
    const isConfidential = confidentialRaw === 'true' || confidentialRaw === '1'

    if (!projectId) throw new ValidationError('请选择项目')
    await assertMemberActiveProject(profile.id, projectId)

    /** 参考资料上传不包含「原件」；成果上传单独使用 original */
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
    const dup = await existsReferenceDuplicateName(projectId, displayName)
    if (dup) {
      throw new BusinessError(
        '该项目下已存在同名参考资料，请修改文件名后重试'
      )
    }

    const mime = file.type?.trim() || 'application/octet-stream'
    const extForTemp = extLower ?? 'bin'
    const processed = await decryptClientFileToBuffer(file, extForTemp)
    if (processed.length === 0) throw new ValidationError('处理后的文件为空')

    const fileId = randomUUID()
    const objectPath = `${projectId}/reference/${fileId}.${extLower ?? 'bin'}`

    const supabase = await createClient()
    await uploadProjectFileBuffer(supabase, {
      objectPath,
      body: processed,
      contentType: mime,
    })

    await insertReferenceFileRow(supabase, {
      id: fileId,
      projectId,
      fileName: displayName,
      fileSize: processed.length,
      fileExt: extLower,
      mimeType: mime,
      sourceStorageKey: objectPath,
      uploaderId: profile.id,
      fileSource: sourceRaw,
      isConfidential,
    })

    await insertFileInteractionsForUpload(supabase, {
      fileId,
      userId: profile.id,
      recommend: parseFormBool(formData.get('recommend')),
      favorite: parseFormBool(formData.get('favorite')),
    })

    return { id: fileId }
  })
}

export async function uploadDeliverableFileAction(formData: FormData) {
  return handleAction(async () => {
    const profile = await requireProfile()
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
    await assertMemberActiveProject(profile.id, projectId)

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

    const supabase = await createClient()

    let versionGroupId: string
    let contractDeliverableIdForInsert: string | null

    /** 入库文件名始终为上传文件的原始文件名（含版本与日期段） */
    const fileNameForDb = basename

    if (deliverableMode === 'standalone' && existingDeliverableFileId) {
      const row = await getDeliverableFileRow(existingDeliverableFileId)
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
        throw new ValidationError('无法从已关联成果解析逻辑名，请更换关联项或联系管理员')
      }
      if (parsed.baseName.trim() !== linkedLogical) {
        throw new ValidationError(
          `文件的逻辑名「${parsed.baseName.trim()}」须与所关联非合同成果的逻辑名「${linkedLogical}」一致`
        )
      }
      versionGroupId = row.version_group_id
      contractDeliverableIdForInsert = null
    } else if (deliverableMode === 'contract' && contractDeliverableId) {
      const cdName = await getContractDeliverableName(
        supabase,
        contractDeliverableId
      )
      if (!cdName) throw new ValidationError('合同成果项不存在')

      if (parsed.baseName.trim() !== cdName.trim()) {
        throw new ValidationError(
          `文件的逻辑名「${parsed.baseName.trim()}」须与所选合同成果项名称「${cdName.trim()}」一致`
        )
      }

      const { data: cdRow, error: cdErr } = await supabase
        .from('contract_deliverables')
        .select('project_id')
        .eq('id', contractDeliverableId)
        .maybeSingle()
      if (cdErr) throw new BusinessError('校验合同成果失败')
      if (cdRow?.project_id !== projectId) {
        throw new ValidationError('合同成果与所选项目不一致')
      }

      contractDeliverableIdForInsert = contractDeliverableId

      const { data: first } = await supabase
        .from('files')
        .select('version_group_id')
        .eq('project_id', projectId)
        .eq('contract_deliverable_id', contractDeliverableId)
        .eq('is_deliverable', true)
        .limit(1)
        .maybeSingle()
      versionGroupId = first?.version_group_id ?? randomUUID()
    } else {
      /** 未关联合同项、也未关联已有非合同成果：新建版本组，作为该文件的首个版本 */
      versionGroupId = randomUUID()
      contractDeliverableIdForInsert = null
    }

    const hasDup = await existsDeliverableVersionInGroup(
      versionGroupId,
      versionLabelForDb
    )
    if (hasDup) {
      throw new BusinessError(
        '该项目下已存在相同合同成果与相同版本号，请修改文件名中的版本后重试'
      )
    }

    await markGroupFilesNotLatest(supabase, versionGroupId)
    const versionNo = await getNextVersionNoInGroup(supabase, versionGroupId)

    const fileId = randomUUID()
    const objectPath = `${projectId}/deliverable/${versionGroupId}/${fileId}.${extForStorage}`

    const mime = file.type?.trim() || 'application/octet-stream'
    const extForTemp = extLower ?? 'bin'
    const processed = await decryptClientFileToBuffer(file, extForTemp)
    if (processed.length === 0) throw new ValidationError('处理后的文件为空')

    await uploadProjectFileBuffer(supabase, {
      objectPath,
      body: processed,
      contentType: mime,
    })

    await insertDeliverableFileRow(supabase, {
      id: fileId,
      projectId,
      fileName: fileNameForDb,
      fileSize: processed.length,
      fileExt: extForStorage,
      mimeType: mime,
      sourceStorageKey: objectPath,
      uploaderId: profile.id,
      versionGroupId,
      versionNo,
      versionLabel: versionLabelForDb,
      contractDeliverableId: contractDeliverableIdForInsert,
      fileSource: 'original',
      isConfidential,
    })

    const refIds = referenceIdsRaw
      ? referenceIdsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : []
    for (const rid of refIds) {
      const { data: rf, error: re } = await supabase
        .from('files')
        .select('project_id, is_deliverable')
        .eq('id', rid)
        .maybeSingle()
      if (re) throw new BusinessError('校验参考文件失败')
      if (!rf || rf.project_id !== projectId || rf.is_deliverable) {
        throw new ValidationError('参考文件无效或不属于该项目')
      }
    }
    await insertFileReferenceLinks(supabase, fileId, refIds)

    await insertFileInteractionsForUpload(supabase, {
      fileId,
      userId: profile.id,
      recommend: parseFormBool(formData.get('recommend')),
      favorite: parseFormBool(formData.get('favorite')),
    })

    return { id: fileId }
  })
}
