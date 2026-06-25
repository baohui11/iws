import { BusinessError, NotFoundError, ValidationError } from '@/core/errors'
import { mapDbError } from '@/core/db/errors'
import { requireAdmin } from '@/modules/org/guard'
import { findDepartmentIdByName } from '@/modules/org/departments/repo'
import { findUserIdByEmployeeNo } from '@/modules/org/users/repo'
import {
  isProjectRoleAllowedForStage,
  parseProjectRoleFromImport,
} from '@/constants/project-roles'
import {
  parseProjectStage,
  parseProjectStageFromImport,
} from '@/constants/project-stage'
import {
  findActiveProjectIdByProjectNo,
  getProjectById,
  getProjectList,
  getProjectStageById,
  insertContractDeliverable,
  insertProject,
  replaceProjectMembers,
  softDeleteProject,
  syncContractDeliverables,
  updateProjectRow,
  upsertProjectFromImport,
  upsertProjectMember,
  type DeliverableInput,
  type MemberInput,
  type ProjectImportRow,
  type ProjectListParams,
} from './repo'
import type { InsertProjectData } from './types'
import type {
  ParsedProjectDeliverableRow,
  ParsedProjectMemberRow,
  ParsedProjectRow,
} from './csv'

export async function listProjects(params: ProjectListParams) {
  await requireAdmin()
  return getProjectList(params)
}

export async function getProject(id: string) {
  await requireAdmin()
  const row = await getProjectById(id)
  if (!row) throw new NotFoundError('项目不存在')
  return row
}

export interface SaveProjectInput {
  project_no: string
  project_name?: string | null
  customer_name?: string | null
  department_id?: string | null
  fiscal_year?: string | null
  project_status?: InsertProjectData['project_status']
  project_stage?: string | null
  start_date?: string | null
  end_date?: string | null
  contract_no?: string | null
  business_type?: string | null
  industry_category?: string | null
  product_block?: string | null
  project_introduction?: string | null
  members: MemberInput[]
  deliverables: DeliverableInput[]
}

function assertMembersMatchProjectStage(
  projectStage: string | null | undefined,
  members: MemberInput[]
) {
  if (!members.length) return
  const stage = parseProjectStage(projectStage ?? undefined)
  if (!stage) {
    throw new ValidationError('已添加成员时须选择项目阶段（实施阶段或销售阶段）')
  }
  for (const m of members) {
    if (!isProjectRoleAllowedForStage(projectStage, m.project_role)) {
      throw new ValidationError(
        '成员角色与项目阶段不匹配（实施阶段：项目经理/成员/总监；销售阶段：项目经理/成员/销售LD）'
      )
    }
  }
}

function toInsertPayload(input: SaveProjectInput): InsertProjectData {
  return {
    project_no: input.project_no.trim(),
    project_name: input.project_name?.trim() || null,
    customer_name: input.customer_name?.trim() || null,
    department_id: input.department_id?.trim() || null,
    fiscal_year: input.fiscal_year?.trim() || null,
    project_status: input.project_status ?? null,
    project_stage: input.project_stage?.trim() || null,
    start_date: input.start_date?.trim() || null,
    end_date: input.end_date?.trim() || null,
    contract_no: input.contract_no?.trim() || null,
    business_type: input.business_type?.trim() || null,
    industry_category: input.industry_category?.trim() || null,
    product_block: input.product_block?.trim() || null,
    project_introduction: input.project_introduction?.trim() || null,
  }
}

export async function createProject(input: SaveProjectInput) {
  await requireAdmin()
  if (!input.project_no?.trim()) throw new ValidationError('项目编号不能为空')
  assertMembersMatchProjectStage(input.project_stage, input.members ?? [])
  try {
    const id = await insertProject(toInsertPayload(input))
    await replaceProjectMembers(id, input.members ?? [])
    await syncContractDeliverables(id, input.deliverables ?? [])
    return { id }
  } catch (e) {
    mapDbError(e)
  }
}

export async function updateProject(id: string, input: SaveProjectInput) {
  await requireAdmin()
  if (!id?.trim()) throw new ValidationError('项目 ID 不能为空')
  const existing = await getProjectById(id)
  if (!existing) throw new NotFoundError('项目不存在')
  if (!input.project_no?.trim()) throw new ValidationError('项目编号不能为空')
  assertMembersMatchProjectStage(input.project_stage, input.members ?? [])
  try {
    await updateProjectRow(id, toInsertPayload(input))
    await replaceProjectMembers(id, input.members ?? [])
    await syncContractDeliverables(id, input.deliverables ?? [])
    return { id }
  } catch (e) {
    mapDbError(e)
  }
}

export async function removeProject(id: string) {
  await requireAdmin()
  if (!id?.trim()) throw new ValidationError('项目 ID 不能为空')
  const existing = await getProjectById(id)
  if (!existing) throw new NotFoundError('项目不存在')
  await softDeleteProject(id)
  return { id }
}

interface ImportResult<T> {
  total: number
  succeeded: number
  failed: number
  results: T[]
}

function parsedRowToImport(row: ParsedProjectRow): ProjectImportRow {
  const stageRaw = row.project_stage?.trim()
  let project_stage: string | null = null
  if (stageRaw) {
    const st = parseProjectStageFromImport(stageRaw)
    if (!st) {
      throw new ValidationError(
        `项目阶段无效：${stageRaw}（请填 实施阶段 / 销售阶段 或 implementation / sales）`
      )
    }
    project_stage = st
  }
  return {
    project_no: row.project_no,
    project_name: row.project_name || null,
    customer_name: row.customer_name || null,
    department_id: row.department_id || null,
    fiscal_year: row.fiscal_year || null,
    project_status: row.project_status,
    project_stage,
    start_date: row.start_date || null,
    end_date: row.end_date || null,
    contract_no: row.contract_no || null,
    business_type: row.business_type || null,
    industry_category: row.industry_category || null,
    product_block: row.product_block || null,
    project_introduction: row.project_introduction || null,
  }
}

export async function importProjects(rows: ParsedProjectRow[]) {
  await requireAdmin()
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ValidationError('项目列表不能为空')
  }
  const results: Array<{
    project_no: string
    success: boolean
    projectId?: string
    message?: string
  }> = []
  for (const row of rows) {
    try {
      if (!row.project_no?.trim()) throw new ValidationError('项目编号不能为空')
      let departmentId = row.department_id?.trim() || null
      if (!departmentId && row.department_name?.trim()) {
        departmentId = await findDepartmentIdByName(row.department_name)
        if (!departmentId) {
          throw new BusinessError(`未找到部门：${row.department_name}`)
        }
      }
      const payload = parsedRowToImport(row)
      if (departmentId) payload.department_id = departmentId
      const projectId = await upsertProjectFromImport(payload)
      results.push({ project_no: row.project_no, success: true, projectId })
    } catch (e) {
      results.push({
        project_no: row.project_no || '(空)',
        success: false,
        message: e instanceof Error ? e.message : '导入失败',
      })
    }
  }
  const succeeded = results.filter((r) => r.success).length
  return {
    total: rows.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  } satisfies ImportResult<(typeof results)[number]>
}

export async function importProjectMembers(rows: ParsedProjectMemberRow[]) {
  await requireAdmin()
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ValidationError('数据不能为空')
  }
  const results: Array<{
    project_no: string
    employee_no: string
    success: boolean
    message?: string
  }> = []
  for (const row of rows) {
    try {
      if (!row.project_no?.trim()) throw new ValidationError('项目编号不能为空')
      if (!row.employee_no?.trim()) throw new ValidationError('用户工号不能为空')
      const role = parseProjectRoleFromImport(row.project_role)
      if (!role) {
        throw new ValidationError(
          '项目角色无效（pm/member/director/sale_ld 或 项目经理/项目成员/项目总监/销售LD）'
        )
      }
      const projectId = await findActiveProjectIdByProjectNo(row.project_no)
      if (!projectId) throw new BusinessError(`未找到项目：${row.project_no}`)
      const projectStage = await getProjectStageById(projectId)
      if (!isProjectRoleAllowedForStage(projectStage, role)) {
        throw new ValidationError(
          '该项目阶段下不能使用此角色（实施：pm/member/director；销售：pm/member/sale_ld）'
        )
      }
      const userId = await findUserIdByEmployeeNo(row.employee_no)
      if (!userId) throw new BusinessError(`未找到用户：${row.employee_no}`)
      await upsertProjectMember(projectId, userId, role)
      results.push({
        project_no: row.project_no,
        employee_no: row.employee_no,
        success: true,
      })
    } catch (e) {
      results.push({
        project_no: row.project_no || '(空)',
        employee_no: row.employee_no || '(空)',
        success: false,
        message: e instanceof Error ? e.message : '导入失败',
      })
    }
  }
  const succeeded = results.filter((r) => r.success).length
  return {
    total: rows.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  } satisfies ImportResult<(typeof results)[number]>
}

export async function importProjectDeliverables(
  rows: ParsedProjectDeliverableRow[]
) {
  await requireAdmin()
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ValidationError('数据不能为空')
  }
  const results: Array<{
    project_no: string
    name: string
    success: boolean
    message?: string
  }> = []
  for (const row of rows) {
    try {
      if (!row.project_no?.trim()) throw new ValidationError('项目编号不能为空')
      if (!row.name?.trim()) throw new ValidationError('成果名称不能为空')
      const projectId = await findActiveProjectIdByProjectNo(row.project_no)
      if (!projectId) throw new BusinessError(`未找到项目：${row.project_no}`)
      await insertContractDeliverable(
        projectId,
        row.name.trim(),
        row.description?.trim() ? row.description.trim() : null
      )
      results.push({ project_no: row.project_no, name: row.name, success: true })
    } catch (e) {
      results.push({
        project_no: row.project_no || '(空)',
        name: row.name || '(空)',
        success: false,
        message: e instanceof Error ? e.message : '导入失败',
      })
    }
  }
  const succeeded = results.filter((r) => r.success).length
  return {
    total: rows.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  } satisfies ImportResult<(typeof results)[number]>
}
