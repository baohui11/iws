import { and, count, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { departments, projectMembers, projects } from '@/core/db/schema'
import type { SystemRole } from '@/core/auth/current-user'
import { getDepartmentIdsForListFilter } from '@/modules/org/departments/repo'
import { PROJECT_STATUS_VALUES } from '@/constants/project-status'
import { parseProjectRole, type ProjectRoleValue } from '@/constants/project-roles'
import type { ProjectDetail, ProjectListItem } from '@/modules/projects/types'
import { getProjectById } from '@/modules/projects/repo'
import type { WeeklyProjectListItem } from '@/modules/projects/types'

export interface WeeklyMyProjectsParams {
  userId: string
  role: SystemRole | null
  userDepartmentId: string | null
  page?: number
  pageSize?: number
  offset?: number
  keyword?: string | null
  departmentFilterId?: string | null
  onlyParticipating?: boolean
  projectStatusFilter?: string | null
}

export interface WeeklyMyProjectsResult {
  projects: WeeklyProjectListItem[]
  total: number
  page: number
  pageSize: number
}

async function fetchMemberProjectIds(userId: string): Promise<string[]> {
  const db = getDb()
  const rows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(
      and(eq(projectMembers.userId, userId), isNull(projectMembers.deletedAt))
    )
  const ids = rows
    .map((r) => r.projectId)
    .filter((id): id is string => id != null)
  return [...new Set(ids)]
}

async function fetchMyProjectRoles(
  userId: string,
  projectIds: string[]
): Promise<Map<string, ProjectRoleValue | null>> {
  const map = new Map<string, ProjectRoleValue | null>()
  if (!projectIds.length) return map

  const db = getDb()
  const rows = await db
    .select({
      projectId: projectMembers.projectId,
      projectRole: projectMembers.projectRole,
    })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        inArray(projectMembers.projectId, projectIds),
        isNull(projectMembers.deletedAt)
      )
    )

  for (const r of rows) {
    if (r.projectId) {
      map.set(r.projectId, parseProjectRole(r.projectRole))
    }
  }
  return map
}

async function getDeptRoleScopeIds(
  role: SystemRole | null,
  userDepartmentId: string | null
): Promise<string[]> {
  if ((role === 'dept_ld' || role === 'dept_admin') && userDepartmentId) {
    return getDepartmentIdsForListFilter(userDepartmentId)
  }
  return []
}

function mapRowToWeeklyItem(
  row: {
    id: string
    projectNo: string | null
    projectName: string | null
    customerName: string | null
    fiscalYear: string | null
    projectStatus: ProjectListItem['project_status']
    projectStage: string | null
    startDate: string | null
    endDate: string | null
    contractNo: string | null
    departmentId: string | null
    departmentName: string | null
  },
  memberSet: Set<string>,
  roleByProject: Map<string, ProjectRoleValue | null>
): WeeklyProjectListItem {
  const participating = memberSet.has(row.id)
  return {
    id: row.id,
    project_no: row.projectNo,
    project_name: row.projectName,
    customer_name: row.customerName,
    fiscal_year: row.fiscalYear,
    project_status: row.projectStatus,
    project_stage: row.projectStage,
    start_date: row.startDate,
    end_date: row.endDate,
    contract_no: row.contractNo,
    department_id: row.departmentId,
    department_name: row.departmentName,
    is_participating: participating,
    my_project_role: participating ? roleByProject.get(row.id) ?? null : null,
  }
}

export async function getMyWeeklyProjectsList(
  params: WeeklyMyProjectsParams
): Promise<WeeklyMyProjectsResult> {
  const {
    userId,
    role,
    userDepartmentId,
    page = 1,
    pageSize: pageSizeRaw = 20,
    offset: offsetParam,
    keyword,
    departmentFilterId,
    onlyParticipating,
    projectStatusFilter,
  } = params

  const pageSize = Math.min(Math.max(1, pageSizeRaw), 100)
  const offset =
    offsetParam != null
      ? Math.max(0, offsetParam)
      : Math.max(0, (page - 1) * pageSize)

  const memberProjectIds = await fetchMemberProjectIds(userId)
  const memberSet = new Set(memberProjectIds)
  const scopeDeptIds = await getDeptRoleScopeIds(role, userDepartmentId)

  const db = getDb()
  const conditions = [isNull(projects.deletedAt)]

  if (keyword?.trim()) {
    const k = `%${keyword.trim()}%`
    conditions.push(
      or(
        ilike(projects.projectNo, k),
        ilike(projects.projectName, k),
        ilike(projects.customerName, k),
        ilike(projects.contractNo, k)
      )!
    )
  }

  if (projectStatusFilter?.trim()) {
    const s = projectStatusFilter.trim()
    if ((PROJECT_STATUS_VALUES as readonly string[]).includes(s)) {
      conditions.push(eq(projects.projectStatus, s as typeof projects.projectStatus.enumValues[number]))
    }
  }

  if (departmentFilterId?.trim()) {
    const deptIds = await getDepartmentIdsForListFilter(departmentFilterId.trim())
    if (deptIds.length) {
      conditions.push(inArray(projects.departmentId, deptIds))
    } else {
      return {
        projects: [],
        total: 0,
        page: Math.floor(offset / pageSize) + 1,
        pageSize,
      }
    }
  }

  if (onlyParticipating) {
    if (!memberProjectIds.length) {
      return {
        projects: [],
        total: 0,
        page: Math.floor(offset / pageSize) + 1,
        pageSize,
      }
    }
    conditions.push(inArray(projects.id, memberProjectIds))
  } else if (role !== 'admin') {
    if (!memberProjectIds.length && !scopeDeptIds.length) {
      return {
        projects: [],
        total: 0,
        page: Math.floor(offset / pageSize) + 1,
        pageSize,
      }
    }
    if (memberProjectIds.length && scopeDeptIds.length) {
      conditions.push(
        or(
          inArray(projects.id, memberProjectIds),
          inArray(projects.departmentId, scopeDeptIds)
        )!
      )
    } else if (memberProjectIds.length) {
      conditions.push(inArray(projects.id, memberProjectIds))
    } else {
      conditions.push(inArray(projects.departmentId, scopeDeptIds))
    }
  }

  const whereClause = and(...conditions)

  const [{ value: totalCount }] = await db
    .select({ value: count() })
    .from(projects)
    .where(whereClause)

  const rows = await db
    .select({
      id: projects.id,
      projectNo: projects.projectNo,
      projectName: projects.projectName,
      customerName: projects.customerName,
      fiscalYear: projects.fiscalYear,
      projectStatus: projects.projectStatus,
      projectStage: projects.projectStage,
      startDate: projects.startDate,
      endDate: projects.endDate,
      contractNo: projects.contractNo,
      departmentId: projects.departmentId,
      departmentName: departments.name,
    })
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .where(whereClause)
    .orderBy(desc(projects.createdAt))
    .offset(offset)
    .limit(pageSize)

  const projectIds = rows.map((r) => r.id)
  const roleByProject = await fetchMyProjectRoles(userId, projectIds)

  const list: WeeklyProjectListItem[] = rows.map((row) =>
    mapRowToWeeklyItem(
      {
        ...row,
        departmentName: row.departmentName ?? null,
      },
      memberSet,
      roleByProject
    )
  )

  return {
    projects: list,
    total: totalCount ?? 0,
    page: Math.floor(offset / pageSize) + 1,
    pageSize,
  }
}

export interface WeeklyProjectAccessContext {
  userId: string
  role: SystemRole | null
  userDepartmentId: string | null
}

export async function canAccessWeeklyProject(
  ctx: WeeklyProjectAccessContext,
  projectId: string
): Promise<boolean> {
  if (ctx.role === 'admin') {
    const db = getDb()
    const rows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1)
    return rows.length > 0
  }

  const memberIds = await fetchMemberProjectIds(ctx.userId)
  if (memberIds.includes(projectId)) return true

  const db = getDb()
  const projRows = await db
    .select({ departmentId: projects.departmentId })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  const proj = projRows[0]
  if (!proj?.departmentId) return false

  if (
    (ctx.role === 'dept_ld' || ctx.role === 'dept_admin') &&
    ctx.userDepartmentId
  ) {
    const scope = await getDepartmentIdsForListFilter(ctx.userDepartmentId)
    if (scope.includes(proj.departmentId)) return true
  }

  return false
}

export async function getWeeklyProjectDetailById(
  projectId: string
): Promise<ProjectDetail | null> {
  return getProjectById(projectId)
}

export async function getWeeklyProjectSummaryById(
  projectId: string
): Promise<ProjectListItem | null> {
  const db = getDb()
  const rows = await db
    .select({
      id: projects.id,
      projectNo: projects.projectNo,
      projectName: projects.projectName,
      customerName: projects.customerName,
      fiscalYear: projects.fiscalYear,
      projectStatus: projects.projectStatus,
      projectStage: projects.projectStage,
      startDate: projects.startDate,
      endDate: projects.endDate,
      contractNo: projects.contractNo,
      departmentId: projects.departmentId,
      departmentName: departments.name,
    })
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    project_no: row.projectNo,
    project_name: row.projectName,
    customer_name: row.customerName,
    fiscal_year: row.fiscalYear,
    project_status: row.projectStatus as ProjectListItem['project_status'],
    project_stage: row.projectStage,
    start_date: row.startDate,
    end_date: row.endDate,
    contract_no: row.contractNo,
    department_id: row.departmentId,
    department_name: row.departmentName ?? null,
  }
}
