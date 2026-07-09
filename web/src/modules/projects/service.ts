import { BusinessError, NotFoundError, ValidationError } from '@/core/errors'
import { requireAdmin } from '@/modules/org/guard'
import { getAdminDepartmentScopeIds } from '@/modules/org/departments/repo'
import {
  findActiveProjectByProjectNo,
  getProjectById,
  getProjectList,
  insertContractDeliverable,
  syncContractDeliverables,
  type DeliverableInput,
  type ProjectListParams,
} from './repo'
import type { ProjectListItem } from './types'
import type { ParsedProjectDeliverableRow } from './csv'

export async function listProjects(params: ProjectListParams) {
  const user = await requireAdmin()
  const allowedDepartmentIds = await getAdminDepartmentScopeIds(user)
  return getProjectList({ ...params, allowed_department_ids: allowedDepartmentIds })
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function projectsToCsv(projects: ProjectListItem[]): string {
  const header = ['项目编号', '项目名称', '部门', '项目阶段', '项目状态', '项目类型', '合同编号', '财年', '开始日期', '结束日期', 'IWS状态']
  const rows = projects.map((project) => [
    project.project_no,
    project.project_name,
    project.department_name,
    project.project_stage,
    project.project_status,
    project.project_type,
    project.contract_no,
    project.fiscal_year,
    project.start_date,
    project.end_date,
    project.is_active ? '已生效' : '未生效',
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export async function exportProjectsCsv(params: ProjectListParams) {
  const user = await requireAdmin()
  const allowedDepartmentIds = await getAdminDepartmentScopeIds(user)
  const result = await getProjectList({
    ...params,
    page: 1,
    pageSize: 10000,
    allowed_department_ids: allowedDepartmentIds,
  })
  return {
    filename: `projects-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: `\uFEFF${projectsToCsv(result.projects)}`,
  }
}

export async function getProject(id: string) {
  const user = await requireAdmin()
  const row = await getProjectById(id)
  if (!row) throw new NotFoundError('项目不存在')
  const allowedDepartmentIds = await getAdminDepartmentScopeIds(user)
  if (
    allowedDepartmentIds &&
    (!row.department_id || !allowedDepartmentIds.includes(row.department_id))
  ) {
    throw new NotFoundError('项目不存在')
  }
  return row
}

export async function saveProjectDeliverables(input: {
  project_id: string
  items: DeliverableInput[]
}) {
  const project = await getProject(input.project_id)
  if (!project) throw new NotFoundError('项目不存在')
  const deliverables = await syncContractDeliverables(input.project_id, input.items)
  return { project_id: input.project_id, deliverables }
}

interface ImportResult<T> {
  total: number
  succeeded: number
  failed: number
  results: T[]
}

export async function importProjectDeliverables(
  rows: ParsedProjectDeliverableRow[]
) {
  const user = await requireAdmin()
  const allowedDepartmentIds = await getAdminDepartmentScopeIds(user)
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
      const project = await findActiveProjectByProjectNo(row.project_no)
      if (!project) throw new BusinessError(`未找到项目：${row.project_no}`)
      if (
        allowedDepartmentIds &&
        (!project.department_id || !allowedDepartmentIds.includes(project.department_id))
      ) {
        throw new BusinessError(`无权导入项目：${row.project_no}`)
      }
      await insertContractDeliverable(
        project.id,
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
