import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import {
  contractDeliverables,
  departments,
  projectMembers,
  projects,
  users,
} from '@/core/db/schema'
import { getDepartmentIdsForListFilter } from '@/modules/org/departments/repo'
import { BusinessError } from '@/core/errors'
import type { ProjectStatusValue } from '@/constants/project-status'
import type { ProjectStageValue } from '@/constants/project-stage'
import type { ProjectRoleValue } from '@/constants/project-roles'
import { mapDbProjectMemberToRow } from './member-mapper'
import type {
  DeliverableRow,
  InsertProjectData,
  ProjectDetail,
  ProjectListItem,
  ProjectMemberRow,
  UpdateProjectData,
} from './types'

export interface ProjectListParams {
  page?: number
  pageSize?: number
  keyword?: string
  department_id?: string
}

export interface ProjectListResult {
  projects: ProjectListItem[]
  total: number
  page: number
  pageSize: number
}

export interface MemberInput {
  user_id: string
  project_role: ProjectRoleValue
}

export interface DeliverableInput {
  id?: string
  name: string
  description?: string | null
}

function toIso(d: Date | string | null): string | null {
  if (d == null) return null
  return d instanceof Date ? d.toISOString() : d
}

/** snake_case 写入数据 → Drizzle 列值（仅包含提供的字段） */
function toProjectValues(d: InsertProjectData | UpdateProjectData) {
  const v: Record<string, unknown> = {}
  if (d.project_no !== undefined) v.projectNo = d.project_no
  if (d.project_name !== undefined) v.projectName = d.project_name
  if (d.customer_name !== undefined) v.customerName = d.customer_name
  if (d.department_id !== undefined) v.departmentId = d.department_id
  if (d.fiscal_year !== undefined) v.fiscalYear = d.fiscal_year
  if (d.project_status !== undefined)
    v.projectStatus = d.project_status as ProjectStatusValue | null
  if (d.project_stage) v.projectStage = d.project_stage as ProjectStageValue
  if (d.start_date !== undefined) v.startDate = d.start_date
  if (d.end_date !== undefined) v.endDate = d.end_date
  if (d.contract_no !== undefined) v.contractNo = d.contract_no
  if (d.business_type !== undefined) v.businessType = d.business_type
  if (d.industry_category !== undefined) v.industryCategory = d.industry_category
  if (d.product_block !== undefined) v.productBlock = d.product_block
  if (d.project_introduction !== undefined)
    v.projectIntroduction = d.project_introduction
  return v
}

export async function getProjectList(
  params: ProjectListParams = {}
): Promise<ProjectListResult> {
  const { page = 1, pageSize = 20, keyword, department_id } = params
  const db = getDb()

  const conds = [isNull(projects.deletedAt)]
  if (keyword?.trim()) {
    const k = `%${keyword.trim()}%`
    conds.push(
      or(
        ilike(projects.projectNo, k),
        ilike(projects.projectName, k),
        ilike(projects.customerName, k),
        ilike(projects.contractNo, k)
      )!
    )
  }
  if (department_id) {
    const deptIds = await getDepartmentIdsForListFilter(department_id)
    conds.push(inArray(projects.departmentId, deptIds.length ? deptIds : ['']))
  }
  const where = and(...conds)

  const [{ value: total }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(projects)
    .where(where)

  const rows = await db
    .select({
      id: projects.id,
      project_no: projects.projectNo,
      project_name: projects.projectName,
      customer_name: projects.customerName,
      fiscal_year: projects.fiscalYear,
      project_status: projects.projectStatus,
      project_stage: projects.projectStage,
      start_date: projects.startDate,
      end_date: projects.endDate,
      contract_no: projects.contractNo,
      department_id: projects.departmentId,
      department_name: departments.name,
    })
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .where(where)
    .orderBy(desc(projects.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    projects: rows.map((r) => ({
      ...r,
      project_status: r.project_status as ProjectStatusValue | null,
      department_name: r.department_name ?? null,
    })),
    total: total ?? 0,
    page,
    pageSize,
  }
}

export async function getProjectById(id: string): Promise<ProjectDetail | null> {
  const db = getDb()
  const projRows = await db
    .select({
      id: projects.id,
      business_type: projects.businessType,
      contract_no: projects.contractNo,
      created_at: projects.createdAt,
      customer_name: projects.customerName,
      deleted_at: projects.deletedAt,
      department_id: projects.departmentId,
      end_date: projects.endDate,
      fiscal_year: projects.fiscalYear,
      industry_category: projects.industryCategory,
      product_block: projects.productBlock,
      project_introduction: projects.projectIntroduction,
      project_name: projects.projectName,
      project_no: projects.projectNo,
      project_stage: projects.projectStage,
      project_status: projects.projectStatus,
      start_date: projects.startDate,
      department_name: departments.name,
    })
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1)

  const proj = projRows[0]
  if (!proj) return null

  const mems = await db
    .select({
      id: projectMembers.id,
      user_id: projectMembers.userId,
      project_role: projectMembers.projectRole,
      user_name: users.name,
      user_email: users.email,
    })
    .from(projectMembers)
    .leftJoin(users, eq(projectMembers.userId, users.id))
    .where(
      and(eq(projectMembers.projectId, id), isNull(projectMembers.deletedAt))
    )

  const dels = await db
    .select({
      id: contractDeliverables.id,
      name: contractDeliverables.name,
      description: contractDeliverables.description,
    })
    .from(contractDeliverables)
    .where(eq(contractDeliverables.projectId, id))
    .orderBy(asc(contractDeliverables.createdAt))

  const members: ProjectMemberRow[] = mems.map(mapDbProjectMemberToRow)
  const deliverables: DeliverableRow[] = dels.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
  }))

  return {
    id: proj.id,
    business_type: proj.business_type,
    contract_no: proj.contract_no,
    created_at: toIso(proj.created_at)!,
    customer_name: proj.customer_name,
    deleted_at: toIso(proj.deleted_at),
    department_id: proj.department_id,
    end_date: proj.end_date,
    fiscal_year: proj.fiscal_year,
    industry_category: proj.industry_category,
    product_block: proj.product_block,
    project_introduction: proj.project_introduction,
    project_name: proj.project_name,
    project_no: proj.project_no,
    project_stage: proj.project_stage,
    project_status: proj.project_status as ProjectStatusValue | null,
    start_date: proj.start_date,
    department_name: proj.department_name ?? null,
    members,
    deliverables,
  }
}

export async function insertProject(row: InsertProjectData): Promise<string> {
  const db = getDb()
  const inserted = await db
    .insert(projects)
    .values(toProjectValues(row))
    .returning({ id: projects.id })
  return inserted[0].id
}

export async function updateProjectRow(id: string, updates: UpdateProjectData) {
  const db = getDb()
  await db.update(projects).set(toProjectValues(updates)).where(eq(projects.id, id))
}

export async function softDeleteProject(id: string) {
  const db = getDb()
  const now = new Date()
  await db.update(projects).set({ deletedAt: now }).where(eq(projects.id, id))
  await db
    .update(projectMembers)
    .set({ deletedAt: now })
    .where(
      and(eq(projectMembers.projectId, id), isNull(projectMembers.deletedAt))
    )
  await db
    .delete(contractDeliverables)
    .where(eq(contractDeliverables.projectId, id))
}

export async function replaceProjectMembers(
  projectId: string,
  members: MemberInput[]
) {
  const db = getDb()
  await db
    .update(projectMembers)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        isNull(projectMembers.deletedAt)
      )
    )

  const rows = members
    .filter((m) => m.user_id?.trim())
    .map((m) => ({
      projectId,
      userId: m.user_id.trim(),
      projectRole: m.project_role,
    }))
  if (rows.length === 0) return
  await db.insert(projectMembers).values(rows)
}

export async function syncContractDeliverables(
  projectId: string,
  items: DeliverableInput[]
) {
  const db = getDb()
  const normalized = items
    .filter((d) => d.name?.trim())
    .map((d) => ({
      id: d.id?.trim() || undefined,
      name: d.name.trim(),
      description: d.description?.trim() || null,
    }))

  const existingRows = await db
    .select({ id: contractDeliverables.id })
    .from(contractDeliverables)
    .where(eq(contractDeliverables.projectId, projectId))

  const existingIds = new Set(existingRows.map((r) => r.id))
  const keptIds = new Set<string>()

  for (const row of normalized) {
    if (row.id) {
      if (!existingIds.has(row.id)) {
        throw new BusinessError('合同成果项不存在或已删除')
      }
      await db
        .update(contractDeliverables)
        .set({ name: row.name, description: row.description })
        .where(
          and(
            eq(contractDeliverables.id, row.id),
            eq(contractDeliverables.projectId, projectId)
          )
        )
      keptIds.add(row.id)
    } else {
      await db.insert(contractDeliverables).values({
        projectId,
        name: row.name,
        description: row.description,
      })
    }
  }

  for (const id of existingIds) {
    if (!keptIds.has(id)) {
      await db
        .delete(contractDeliverables)
        .where(
          and(
            eq(contractDeliverables.id, id),
            eq(contractDeliverables.projectId, projectId)
          )
        )
    }
  }
}

export async function upsertProjectMember(
  projectId: string,
  userId: string,
  project_role: ProjectRoleValue
) {
  const db = getDb()
  const existing = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNull(projectMembers.deletedAt)
      )
    )
    .limit(1)

  if (existing[0]) {
    await db
      .update(projectMembers)
      .set({ projectRole: project_role })
      .where(eq(projectMembers.id, existing[0].id))
    return
  }
  await db
    .insert(projectMembers)
    .values({ projectId, userId, projectRole: project_role })
}

export async function insertContractDeliverable(
  projectId: string,
  name: string,
  description: string | null
) {
  const db = getDb()
  await db.insert(contractDeliverables).values({
    projectId,
    name: name.trim(),
    description: description?.trim() ? description.trim() : null,
  })
}

export async function findActiveProjectIdByProjectNo(
  projectNo: string
): Promise<string | null> {
  if (!projectNo?.trim()) return null
  const db = getDb()
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.projectNo, projectNo.trim()), isNull(projects.deletedAt))
    )
    .limit(1)
  return rows[0]?.id ?? null
}

export async function getProjectStageById(
  projectId: string
): Promise<string | null> {
  const db = getDb()
  const rows = await db
    .select({ stage: projects.projectStage })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)
  return rows[0]?.stage ?? null
}

export interface ProjectImportRow {
  project_no: string
  project_name?: string | null
  customer_name?: string | null
  department_id?: string | null
  fiscal_year?: string | null
  project_status?: ProjectStatusValue | null
  project_stage?: string | null
  start_date?: string | null
  end_date?: string | null
  contract_no?: string | null
  business_type?: string | null
  industry_category?: string | null
  product_block?: string | null
  project_introduction?: string | null
}

export async function upsertProjectFromImport(
  row: ProjectImportRow
): Promise<string> {
  const payload: InsertProjectData = {
    project_no: row.project_no.trim(),
    project_name: row.project_name?.trim() || null,
    customer_name: row.customer_name?.trim() || null,
    department_id: row.department_id?.trim() || null,
    fiscal_year: row.fiscal_year?.trim() || null,
    project_status: row.project_status ?? null,
    project_stage: row.project_stage?.trim() || null,
    start_date: row.start_date?.trim() || null,
    end_date: row.end_date?.trim() || null,
    contract_no: row.contract_no?.trim() || null,
    business_type: row.business_type?.trim() || null,
    industry_category: row.industry_category?.trim() || null,
    product_block: row.product_block?.trim() || null,
    project_introduction: row.project_introduction?.trim() || null,
  }
  const existingId = await findActiveProjectIdByProjectNo(row.project_no)
  if (existingId) {
    const { project_no: _n, ...updates } = payload
    void _n
    await updateProjectRow(existingId, updates)
    return existingId
  }
  return insertProject(payload)
}
