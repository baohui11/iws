import { and, count, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import {
  departments,
  projectMembers,
  projects,
  projectWeekExemptions,
} from '@/core/db/schema'
import type { SystemRole } from '@/core/auth/current-user'
import {
  getAdminDepartmentScopeIds,
  getDepartmentIdsForListFilter,
} from '@/modules/org/departments/repo'
import { PROJECT_STATUS_VALUES } from '@/constants/project-status'
import {
  PROJECT_STAGE_VALUES,
  type ProjectStageValue,
} from '@/constants/project-stage'
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
  projectStageFilter?: string | null
  projectStatusFilter?: string | null
}

export interface WeeklyMyProjectsResult {
  projects: WeeklyProjectListItem[]
  total: number
  page: number
  pageSize: number
}

export interface WeeklyAddableProject {
  id: string
  project_no: string | null
  project_name: string | null
  project_stage: string | null
  project_status: ProjectListItem['project_status']
  department_name: string | null
  my_project_role: string | null
}

export interface WeeklyProjectPauseRow {
  id: string
  start_week_code: string
  end_week_code: string | null
  reason: string | null
  created_at: string
}

async function fetchMemberProjectIds(userId: string): Promise<string[]> {
  const db = getDb()
  const rows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.isActive, true),
        isNull(projectMembers.deletedAt)
      )
    )
  const ids = rows
    .map((r) => r.projectId)
    .filter((id): id is string => id != null)
  return [...new Set(ids)]
}

async function fetchMyProjectRoles(
  userId: string,
  projectIds: string[]
): Promise<Map<string, { role: string | null; stages: string[] }>> {
  const map = new Map<string, { role: string | null; stages: string[] }>()
  if (!projectIds.length) return map

  const db = getDb()
  const rows = await db
    .select({
      projectId: projectMembers.projectId,
      projectRole: projectMembers.projectRole,
      projectStage: projectMembers.projectStage,
    })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        inArray(projectMembers.projectId, projectIds),
        eq(projectMembers.isActive, true),
        isNull(projectMembers.deletedAt)
      )
    )

  for (const r of rows) {
    if (r.projectId) {
      const current = map.get(r.projectId) ?? { role: null, stages: [] }
      if (!current.role && r.projectRole?.trim()) {
        current.role = r.projectRole.trim()
      }
      if (r.projectStage && !current.stages.includes(r.projectStage)) {
        current.stages.push(r.projectStage)
      }
      map.set(r.projectId, current)
    }
  }
  return map
}

async function getDeptRoleScopeIds(
  userId: string,
  role: SystemRole | null,
  userDepartmentId: string | null
): Promise<string[] | null> {
  if (!role || role === 'user') {
    return []
  }
  return getAdminDepartmentScopeIds({
    id: userId,
    role,
    departmentId: userDepartmentId,
  })
}

function mapRowToWeeklyItem(
  row: {
    id: string
    projectNo: string | null
    projectName: string | null
    fiscalYear: string | null
    projectStatus: ProjectListItem['project_status']
    projectStage: string | null
    projectType: string | null
    startDate: string | null
    endDate: string | null
    contractNo: string | null
    departmentId: string | null
    departmentName: string | null
    isActive: boolean
  },
  memberSet: Set<string>,
  roleByProject: Map<string, { role: string | null; stages: string[] }>
): WeeklyProjectListItem {
  const participating = memberSet.has(row.id)
  const myProject = roleByProject.get(row.id)
  return {
    id: row.id,
    project_no: row.projectNo,
    project_name: row.projectName,
    fiscal_year: row.fiscalYear,
    project_status: row.projectStatus,
    project_stage: row.projectStage,
    project_type: row.projectType,
    start_date: row.startDate,
    end_date: row.endDate,
    contract_no: row.contractNo,
    department_id: row.departmentId,
    department_name: row.departmentName,
    is_active: row.isActive,
    is_participating: participating,
    my_project_role: participating ? myProject?.role ?? null : null,
    my_project_stages: participating ? myProject?.stages ?? [] : [],
  }
}

export async function searchInactiveMemberProjectsForAdd(params: {
  userId: string
  keyword?: string | null
  limit?: number
}): Promise<WeeklyAddableProject[]> {
  const { userId, keyword, limit = 30 } = params
  const db = getDb()
  const conditions = [
    eq(projectMembers.userId, userId),
    isNull(projectMembers.deletedAt),
    isNull(projects.deletedAt),
    eq(projects.isActive, false),
  ]

  if (keyword?.trim()) {
    const k = `%${keyword.trim()}%`
    conditions.push(
      or(
        ilike(projects.projectNo, k),
        ilike(projects.projectName, k),
        ilike(projects.contractNo, k)
      )!
    )
  }

  const rows = await db
    .select({
      id: projects.id,
      projectNo: projects.projectNo,
      projectName: projects.projectName,
      projectStage: projects.projectStage,
      projectStatus: projects.projectStatus,
      departmentName: departments.name,
      projectRole: projectMembers.projectRole,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .where(and(...conditions))
    .orderBy(desc(projects.createdAt))
    .limit(Math.min(Math.max(1, limit), 100))

  const seen = new Set<string>()
  const out: WeeklyAddableProject[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push({
      id: row.id,
      project_no: row.projectNo,
      project_name: row.projectName,
      project_stage: row.projectStage,
      project_status: row.projectStatus,
      department_name: row.departmentName,
      my_project_role: row.projectRole?.trim() || null,
    })
  }
  return out
}

export async function activateMemberProjectForWeekly(input: {
  userId: string
  projectId: string
}): Promise<boolean> {
  const db = getDb()
  return db.transaction(async (tx) => {
    const memberRows = await tx
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.userId, input.userId),
          eq(projectMembers.projectId, input.projectId),
          isNull(projectMembers.deletedAt)
        )
      )
      .limit(1)

    if (!memberRows.length) return false

    const projectRows = await tx
      .update(projects)
      .set({ isActive: true })
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.isActive, false),
          isNull(projects.deletedAt)
        )
      )
      .returning({ id: projects.id })

    if (!projectRows.length) return false

    await tx
      .update(projectMembers)
      .set({ isActive: true })
      .where(
        and(
          eq(projectMembers.userId, input.userId),
          eq(projectMembers.projectId, input.projectId),
          isNull(projectMembers.deletedAt)
        )
      )

    return true
  })
}

export async function canManageWeeklyProjectSettings(
  userId: string,
  projectId: string
): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .select({
      projectStage: projects.projectStage,
      projectRole: projectMembers.projectRole,
      memberStage: projectMembers.projectStage,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.isActive, true),
        isNull(projectMembers.deletedAt),
        isNull(projects.deletedAt),
        eq(projects.isActive, true)
      )
    )

  return rows.some((row) => {
    if (row.projectStage === '实施阶段') {
      return row.projectRole === '项目经理' && row.memberStage === '实施阶段'
    }
    if (row.projectStage === '销售阶段') {
      return row.projectRole === '销售LD' && row.memberStage === '销售阶段'
    }
    return false
  })
}

export async function updateWeeklyProjectMemberActive(input: {
  projectId: string
  memberId: string
  isActive: boolean
}): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .update(projectMembers)
    .set({ isActive: input.isActive })
    .where(
      and(
        eq(projectMembers.id, input.memberId),
        eq(projectMembers.projectId, input.projectId),
        isNull(projectMembers.deletedAt)
      )
    )
    .returning({ id: projectMembers.id })
  return rows.length > 0
}

export async function listWeeklyProjectPauses(
  projectId: string
): Promise<WeeklyProjectPauseRow[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: projectWeekExemptions.id,
      startWeekCode: projectWeekExemptions.startWeekCode,
      endWeekCode: projectWeekExemptions.endWeekCode,
      reason: projectWeekExemptions.reason,
      createdAt: projectWeekExemptions.createdAt,
    })
    .from(projectWeekExemptions)
    .where(eq(projectWeekExemptions.projectId, projectId))
    .orderBy(desc(projectWeekExemptions.createdAt))

  return rows.map((row) => ({
    id: row.id,
    start_week_code: row.startWeekCode,
    end_week_code: row.endWeekCode,
    reason: row.reason,
    created_at: row.createdAt.toISOString(),
  }))
}

export async function createWeeklyProjectPause(input: {
  projectId: string
  startWeekCode: string
  endWeekCode: string | null
  reason: string | null
  createdBy: string
}): Promise<WeeklyProjectPauseRow> {
  const db = getDb()
  const rows = await db
    .insert(projectWeekExemptions)
    .values({
      projectId: input.projectId,
      startWeekCode: input.startWeekCode,
      endWeekCode: input.endWeekCode || input.startWeekCode,
      reason: input.reason,
      createdBy: input.createdBy,
    })
    .returning({
      id: projectWeekExemptions.id,
      startWeekCode: projectWeekExemptions.startWeekCode,
      endWeekCode: projectWeekExemptions.endWeekCode,
      reason: projectWeekExemptions.reason,
      createdAt: projectWeekExemptions.createdAt,
    })
  const row = rows[0]
  return {
    id: row.id,
    start_week_code: row.startWeekCode,
    end_week_code: row.endWeekCode,
    reason: row.reason,
    created_at: row.createdAt.toISOString(),
  }
}

export async function deleteWeeklyProjectPause(input: {
  projectId: string
  pauseId: string
}): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .delete(projectWeekExemptions)
    .where(
      and(
        eq(projectWeekExemptions.id, input.pauseId),
        eq(projectWeekExemptions.projectId, input.projectId)
      )
    )
    .returning({ id: projectWeekExemptions.id })
  return rows.length > 0
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
    projectStageFilter,
    projectStatusFilter,
  } = params

  const pageSize = Math.min(Math.max(1, pageSizeRaw), 100)
  const offset =
    offsetParam != null
      ? Math.max(0, offsetParam)
      : Math.max(0, (page - 1) * pageSize)

  const memberProjectIds = await fetchMemberProjectIds(userId)
  const memberSet = new Set(memberProjectIds)
  const scopeDeptIds = await getDeptRoleScopeIds(userId, role, userDepartmentId)

  const db = getDb()
  const conditions = [isNull(projects.deletedAt), eq(projects.isActive, true)]

  if (keyword?.trim()) {
    const k = `%${keyword.trim()}%`
    conditions.push(
      or(
        ilike(projects.projectNo, k),
        ilike(projects.projectName, k),
        ilike(projects.contractNo, k)
      )!
    )
  }

  if (projectStageFilter?.trim()) {
    const stage = projectStageFilter.trim()
    if ((PROJECT_STAGE_VALUES as readonly string[]).includes(stage)) {
      conditions.push(eq(projects.projectStage, stage as ProjectStageValue))
    }
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
  } else if (scopeDeptIds !== null) {
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
      fiscalYear: projects.fiscalYear,
      projectStatus: projects.projectStatus,
      projectStage: projects.projectStage,
      projectType: projects.projectType,
      startDate: projects.startDate,
      endDate: projects.endDate,
      contractNo: projects.contractNo,
      departmentId: projects.departmentId,
      departmentName: departments.name,
      isActive: projects.isActive,
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
      .where(
        and(
          eq(projects.id, projectId),
          isNull(projects.deletedAt),
          eq(projects.isActive, true)
        )
      )
      .limit(1)
    return rows.length > 0
  }

  const memberIds = await fetchMemberProjectIds(ctx.userId)
  if (memberIds.includes(projectId)) return true

  const db = getDb()
  const projRows = await db
    .select({ departmentId: projects.departmentId })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        isNull(projects.deletedAt),
        eq(projects.isActive, true)
      )
    )
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
      fiscalYear: projects.fiscalYear,
      projectStatus: projects.projectStatus,
      projectStage: projects.projectStage,
      projectType: projects.projectType,
      startDate: projects.startDate,
      endDate: projects.endDate,
      contractNo: projects.contractNo,
      departmentId: projects.departmentId,
      departmentName: departments.name,
      isActive: projects.isActive,
    })
    .from(projects)
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .where(
      and(
        eq(projects.id, projectId),
        isNull(projects.deletedAt),
        eq(projects.isActive, true)
      )
    )
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    project_no: row.projectNo,
    project_name: row.projectName,
    fiscal_year: row.fiscalYear,
    project_status: row.projectStatus as ProjectListItem['project_status'],
    project_stage: row.projectStage,
    project_type: row.projectType,
    start_date: row.startDate,
    end_date: row.endDate,
    contract_no: row.contractNo,
    department_id: row.departmentId,
    department_name: row.departmentName ?? null,
    is_active: row.isActive,
  }
}
