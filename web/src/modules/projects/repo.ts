import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  notInArray,
  or,
  sql,
} from 'drizzle-orm'
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
import { mapDbProjectMemberToRow } from './member-mapper'
import type {
  DeliverableRow,
  ProjectDetail,
  ProjectListItem,
  ProjectMemberRow,
} from './types'

export interface ProjectListParams {
  page?: number
  pageSize?: number
  keyword?: string
  department_id?: string
  project_stage?: ProjectStageValue
  project_status?: ProjectStatusValue
  allowed_department_ids?: string[] | null
}

export interface ProjectListResult {
  projects: ProjectListItem[]
  total: number
  page: number
  pageSize: number
}

export interface DeliverableInput {
  id?: string
  name: string
  description?: string | null
}

export interface OaProjectSyncData {
  projectNo: string
  projectName: string | null
  projectStage: ProjectStageValue | null
  projectStatus: ProjectStatusValue | null
  departmentCode: string | null
  startDate: string | null
  endDate: string | null
  projectType: string | null
  contractNo: string | null
  fiscalYear: string | null
}

export interface OaProjectRoleSyncData {
  projectNo: string
  employeeNo: string
  projectRole: string
  projectStage: ProjectStageValue
}

export interface OaProjectMissingDepartment {
  projectNo: string
  departmentCode: string
}

export interface OaProjectSyncResult {
  pulledCount: number
  createdCount: number
  updatedCount: number
  unchangedCount: number
  deletedCount: number
  missingDepartments: OaProjectMissingDepartment[]
}

export interface OaProjectRoleMissingProject {
  projectNo: string
  employeeNo: string
  projectStage: ProjectStageValue
}

export interface OaProjectRoleMissingUser {
  projectNo: string
  employeeNo: string
  projectStage: ProjectStageValue
}

export interface OaProjectRoleSyncResult {
  pulledCount: number
  createdCount: number
  updatedCount: number
  unchangedCount: number
  deletedCount: number
  missingProjects: OaProjectRoleMissingProject[]
  missingUsers: OaProjectRoleMissingUser[]
}

function toIso(d: Date | string | null): string | null {
  if (d == null) return null
  return d instanceof Date ? d.toISOString() : d
}

function sameNullableDateText(a: string | null, b: string | null): boolean {
  return (a?.trim() || null) === (b?.trim() || null)
}

export async function getProjectList(
  params: ProjectListParams = {}
): Promise<ProjectListResult> {
  const {
    page = 1,
    pageSize = 20,
    keyword,
    department_id,
    project_stage,
    project_status,
    allowed_department_ids,
  } = params
  const db = getDb()

  const conds = [isNull(projects.deletedAt)]
  if (keyword?.trim()) {
    const k = `%${keyword.trim()}%`
    conds.push(
      or(
        ilike(projects.projectNo, k),
        ilike(projects.projectName, k),
        ilike(projects.contractNo, k)
      )!
    )
  }
  if (department_id) {
    const deptIds = await getDepartmentIdsForListFilter(department_id)
    conds.push(inArray(projects.departmentId, deptIds.length ? deptIds : ['']))
  }
  if (allowed_department_ids) {
    conds.push(
      inArray(
        projects.departmentId,
        allowed_department_ids.length ? allowed_department_ids : ['']
      )
    )
  }
  if (project_stage) {
    conds.push(eq(projects.projectStage, project_stage))
  }
  if (project_status) {
    conds.push(eq(projects.projectStatus, project_status))
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
      fiscal_year: projects.fiscalYear,
      project_status: projects.projectStatus,
      project_stage: projects.projectStage,
      project_type: projects.projectType,
      start_date: projects.startDate,
      end_date: projects.endDate,
      contract_no: projects.contractNo,
      department_id: projects.departmentId,
      department_name: departments.name,
      is_active: projects.isActive,
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
      contract_no: projects.contractNo,
      created_at: projects.createdAt,
      deleted_at: projects.deletedAt,
      department_id: projects.departmentId,
      end_date: projects.endDate,
      fiscal_year: projects.fiscalYear,
      project_name: projects.projectName,
      project_no: projects.projectNo,
      project_stage: projects.projectStage,
      project_status: projects.projectStatus,
      project_type: projects.projectType,
      start_date: projects.startDate,
      is_active: projects.isActive,
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
      project_stage: projectMembers.projectStage,
      is_active: projectMembers.isActive,
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
    contract_no: proj.contract_no,
    created_at: toIso(proj.created_at)!,
    deleted_at: toIso(proj.deleted_at),
    department_id: proj.department_id,
    end_date: proj.end_date,
    fiscal_year: proj.fiscal_year,
    project_name: proj.project_name,
    project_no: proj.project_no,
    project_stage: proj.project_stage,
    project_status: proj.project_status as ProjectStatusValue | null,
    project_type: proj.project_type,
    start_date: proj.start_date,
    is_active: proj.is_active,
    department_name: proj.department_name ?? null,
    members,
    deliverables,
  }
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

export async function findActiveProjectByProjectNo(
  projectNo: string
): Promise<{ id: string; department_id: string | null } | null> {
  if (!projectNo?.trim()) return null
  const db = getDb()
  const rows = await db
    .select({ id: projects.id, department_id: projects.departmentId })
    .from(projects)
    .where(
      and(eq(projects.projectNo, projectNo.trim()), isNull(projects.deletedAt))
    )
    .limit(1)
  return rows[0] ?? null
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

export async function syncProjectsFromOa(
  rows: OaProjectSyncData[]
): Promise<OaProjectSyncResult> {
  const db = getDb()
  const projectNos = [...new Set(rows.map((row) => row.projectNo))]
  if (projectNos.length === 0) {
    return {
      pulledCount: 0,
      createdCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      deletedCount: 0,
      missingDepartments: [],
    }
  }

  const departmentCodes = [
    ...new Set(rows.map((row) => row.departmentCode).filter(Boolean)),
  ] as string[]

  return db.transaction(async (tx) => {
    const departmentRows = departmentCodes.length
      ? await tx
          .select({ id: departments.id, code: departments.code })
          .from(departments)
          .where(inArray(departments.code, departmentCodes))
      : []
    const departmentIdByCode = new Map(
      departmentRows.map((row) => [row.code, row.id])
    )

    const existingRows = await tx
      .select({
        id: projects.id,
        projectNo: projects.projectNo,
        projectName: projects.projectName,
        projectStage: projects.projectStage,
        projectStatus: projects.projectStatus,
        departmentId: projects.departmentId,
        startDate: projects.startDate,
        endDate: projects.endDate,
        projectType: projects.projectType,
        contractNo: projects.contractNo,
        fiscalYear: projects.fiscalYear,
        deletedAt: projects.deletedAt,
        isActive: projects.isActive,
      })
      .from(projects)
      .where(inArray(projects.projectNo, projectNos))

    const existingByProjectNo = new Map(
      existingRows
        .filter((row) => row.projectNo != null)
        .map((row) => [row.projectNo!, row])
    )

    const missingDepartments: OaProjectMissingDepartment[] = []
    let createdCount = 0
    let updatedCount = 0
    let deletedCount = 0
    let unchangedCount = 0

    for (const row of rows) {
      const departmentId = row.departmentCode
        ? departmentIdByCode.get(row.departmentCode) ?? null
        : null
      if (row.departmentCode && !departmentId) {
        missingDepartments.push({
          projectNo: row.projectNo,
          departmentCode: row.departmentCode,
        })
      }

      const existing = existingByProjectNo.get(row.projectNo)
      const projectStage = row.projectStage ?? '实施阶段'
      const projectStatus = row.projectStatus ?? null

      if (!existing) {
        const inserted = await tx
          .insert(projects)
          .values({
            projectNo: row.projectNo,
            projectName: row.projectName,
            projectStage,
            projectStatus,
            departmentId,
            startDate: row.startDate,
            endDate: row.endDate,
            projectType: row.projectType,
            contractNo: row.contractNo,
            fiscalYear: row.fiscalYear,
            deletedAt: null,
            isActive: false,
          })
          .returning({
            id: projects.id,
            projectNo: projects.projectNo,
            projectName: projects.projectName,
            projectStage: projects.projectStage,
            projectStatus: projects.projectStatus,
            departmentId: projects.departmentId,
            startDate: projects.startDate,
            endDate: projects.endDate,
            projectType: projects.projectType,
            contractNo: projects.contractNo,
            fiscalYear: projects.fiscalYear,
            deletedAt: projects.deletedAt,
            isActive: projects.isActive,
          })
        existingByProjectNo.set(row.projectNo, inserted[0])
        createdCount += 1
        continue
      }

      const needsUpdate =
        existing.projectName !== row.projectName ||
        existing.projectStage !== projectStage ||
        existing.projectStatus !== projectStatus ||
        existing.departmentId !== departmentId ||
        !sameNullableDateText(existing.startDate, row.startDate) ||
        !sameNullableDateText(existing.endDate, row.endDate) ||
        existing.projectType !== row.projectType ||
        existing.contractNo !== row.contractNo ||
        existing.fiscalYear !== row.fiscalYear ||
        existing.deletedAt != null

      if (!needsUpdate) {
        unchangedCount += 1
        continue
      }

      const updated = await tx
        .update(projects)
        .set({
          projectName: row.projectName,
          projectStage,
          projectStatus,
          departmentId,
          startDate: row.startDate,
          endDate: row.endDate,
          projectType: row.projectType,
          contractNo: row.contractNo,
          fiscalYear: row.fiscalYear,
          deletedAt: null,
        })
        .where(eq(projects.id, existing.id))
        .returning({
          id: projects.id,
          projectNo: projects.projectNo,
          projectName: projects.projectName,
          projectStage: projects.projectStage,
          projectStatus: projects.projectStatus,
          departmentId: projects.departmentId,
          startDate: projects.startDate,
          endDate: projects.endDate,
          projectType: projects.projectType,
          contractNo: projects.contractNo,
          fiscalYear: projects.fiscalYear,
          deletedAt: projects.deletedAt,
          isActive: projects.isActive,
        })
      existingByProjectNo.set(row.projectNo, updated[0])
      updatedCount += 1
    }

    const deletedRows = await tx
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(
        and(
          notInArray(projects.projectNo, projectNos),
          isNull(projects.deletedAt)
        )
      )
      .returning({ id: projects.id })

    if (deletedRows.length > 0) {
      const deletedProjectIds = deletedRows.map((row) => row.id)
      await tx
        .update(projectMembers)
        .set({ deletedAt: new Date() })
        .where(
          and(
            inArray(projectMembers.projectId, deletedProjectIds),
            isNull(projectMembers.deletedAt)
          )
        )
      deletedCount = deletedRows.length
    }

    return {
      pulledCount: rows.length,
      createdCount,
      updatedCount,
      unchangedCount,
      deletedCount,
      missingDepartments,
    }
  })
}

export async function syncProjectRolesFromOa(
  rows: OaProjectRoleSyncData[]
): Promise<OaProjectRoleSyncResult> {
  const db = getDb()
  if (rows.length === 0) {
    return {
      pulledCount: 0,
      createdCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      deletedCount: 0,
      missingProjects: [],
      missingUsers: [],
    }
  }

  const projectNos = [...new Set(rows.map((row) => row.projectNo))]
  const employeeNos = [...new Set(rows.map((row) => row.employeeNo))]

  return db.transaction(async (tx) => {
    const projectRows = await tx
      .select({ id: projects.id, projectNo: projects.projectNo })
      .from(projects)
      .where(inArray(projects.projectNo, projectNos))
    const projectIdByNo = new Map(
      projectRows
        .filter((row) => row.projectNo != null)
        .map((row) => [row.projectNo!, row.id])
    )

    const userRows = await tx
      .select({ id: users.id, employeeNo: users.employeeNo })
      .from(users)
      .where(inArray(users.employeeNo, employeeNos))
    const userIdByEmployeeNo = new Map(
      userRows
        .filter((row) => row.employeeNo != null)
        .map((row) => [row.employeeNo!, row.id])
    )

    const projectIds = [...new Set(projectRows.map((row) => row.id))]
    const memberRows =
      projectIds.length
        ? await tx
            .select({
              id: projectMembers.id,
              projectId: projectMembers.projectId,
              userId: projectMembers.userId,
              projectRole: projectMembers.projectRole,
              projectStage: projectMembers.projectStage,
              isActive: projectMembers.isActive,
              deletedAt: projectMembers.deletedAt,
            })
            .from(projectMembers)
            .where(inArray(projectMembers.projectId, projectIds))
        : []

    const existingByKey = new Map<string, (typeof memberRows)[number]>()
    for (const row of memberRows) {
      if (!row.projectId || !row.userId || !row.projectRole) continue
      existingByKey.set(`${row.projectId}|${row.userId}|${row.projectRole}`, row)
    }

    const missingProjects: OaProjectRoleMissingProject[] = []
    const missingUsers: OaProjectRoleMissingUser[] = []
    let createdCount = 0
    let updatedCount = 0
    let deletedCount = 0
    let unchangedCount = 0
    const incomingKeys = new Set<string>()

    for (const row of rows) {
      const projectId = projectIdByNo.get(row.projectNo)
      const userId = userIdByEmployeeNo.get(row.employeeNo)
      if (!projectId) {
        missingProjects.push({
          projectNo: row.projectNo,
          employeeNo: row.employeeNo,
          projectStage: row.projectStage,
        })
      }
      if (!userId) {
        missingUsers.push({
          projectNo: row.projectNo,
          employeeNo: row.employeeNo,
          projectStage: row.projectStage,
        })
      }
      if (!projectId || !userId) continue

      const key = `${projectId}|${userId}|${row.projectRole}`
      incomingKeys.add(key)
      const existing = existingByKey.get(key)
      if (!existing) {
        const inserted = await tx
          .insert(projectMembers)
          .values({
            projectId,
            userId,
            projectRole: row.projectRole,
            projectStage: row.projectStage,
            isActive: true,
            deletedAt: null,
          })
          .returning({
            id: projectMembers.id,
            projectId: projectMembers.projectId,
            userId: projectMembers.userId,
            projectRole: projectMembers.projectRole,
            projectStage: projectMembers.projectStage,
            isActive: projectMembers.isActive,
            deletedAt: projectMembers.deletedAt,
          })
        existingByKey.set(key, inserted[0])
        createdCount += 1
        continue
      }

      const needsUpdate =
        existing.projectStage !== row.projectStage ||
        existing.isActive !== true ||
        existing.deletedAt != null
      if (!needsUpdate) {
        unchangedCount += 1
        continue
      }

      const updated = await tx
        .update(projectMembers)
        .set({
          projectRole: row.projectRole,
          projectStage: row.projectStage,
          isActive: true,
          deletedAt: null,
        })
        .where(eq(projectMembers.id, existing.id))
        .returning({
          id: projectMembers.id,
          projectId: projectMembers.projectId,
          userId: projectMembers.userId,
          projectRole: projectMembers.projectRole,
          projectStage: projectMembers.projectStage,
          isActive: projectMembers.isActive,
          deletedAt: projectMembers.deletedAt,
        })
      existingByKey.set(key, updated[0])
      updatedCount += 1
    }

    const now = new Date()
    for (const existing of memberRows) {
      const key =
        existing.projectId && existing.userId && existing.projectRole
          ? `${existing.projectId}|${existing.userId}|${existing.projectRole}`
          : null
      if ((key != null && incomingKeys.has(key)) || existing.deletedAt != null) {
        continue
      }

      await tx
        .update(projectMembers)
        .set({ deletedAt: now })
        .where(eq(projectMembers.id, existing.id))
      deletedCount += 1
    }

    return {
      pulledCount: rows.length,
      createdCount,
      updatedCount,
      unchangedCount,
      deletedCount,
      missingProjects,
      missingUsers,
    }
  })
}
