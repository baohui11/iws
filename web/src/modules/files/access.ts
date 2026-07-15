import { and, eq, isNull } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import type { CurrentUser } from '@/core/auth'
import { getDb } from '@/core/db/client'
import { projectMembers } from '@/core/db/schema'
import { getAdminDepartmentScopeIds } from '@/modules/org/departments/repo'
import type { ProjectStageValue } from '@/constants/project-stage'

export interface FileAccessContext {
  id: string
  uploader_id: string
  project_id: string
  project_stage: ProjectStageValue | null
  department_id: string | null
  is_confidential: boolean
}

const CONFIDENTIAL_DEPARTMENT_CONTENT_ROLES = new Set<string>([
  'admin',
  'company_ld',
  'dept_admin',
  'dept_ld',
])

function uuidArraySql(ids: string[]): SQL {
  return sql`array[${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)}]`
}

export async function getFileDepartmentScopeIds(
  user: Pick<CurrentUser, 'id' | 'role' | 'departmentId'>
): Promise<string[] | null> {
  return getAdminDepartmentScopeIds(user, { includeInactive: true })
}

export async function isFileStageMember(
  userId: string,
  file: Pick<FileAccessContext, 'project_id' | 'project_stage'>
): Promise<boolean> {
  if (!file.project_stage) return false
  const db = getDb()
  const rows = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.projectId, file.project_id),
        eq(projectMembers.projectStage, file.project_stage),
        eq(projectMembers.isActive, true),
        isNull(projectMembers.deletedAt)
      )
    )
    .limit(1)
  return rows.length > 0
}

export async function resolveFileAccess(
  user: CurrentUser,
  file: FileAccessContext
): Promise<{ canViewMetadata: boolean; canAccessContent: boolean }> {
  if (user.role === 'admin') {
    return { canViewMetadata: true, canAccessContent: true }
  }

  const isUploader = file.uploader_id === user.id
  const isStageMember = await isFileStageMember(user.id, file)
  const scopeIds = await getFileDepartmentScopeIds(user)
  const inDepartmentScope =
    scopeIds == null ||
    (file.department_id != null && scopeIds.includes(file.department_id))

  const canViewMetadata = isUploader || isStageMember || inDepartmentScope
  if (!canViewMetadata) {
    return { canViewMetadata: false, canAccessContent: false }
  }

  if (!file.is_confidential) {
    return { canViewMetadata: true, canAccessContent: true }
  }

  const role = user.role
  const canAccessConfidentialByDepartment =
    Boolean(role && CONFIDENTIAL_DEPARTMENT_CONTENT_ROLES.has(role)) &&
    inDepartmentScope

  return {
    canViewMetadata: true,
    canAccessContent:
      isUploader || isStageMember || canAccessConfidentialByDepartment,
  }
}

export function buildVisibleFileSql(input: {
  userId: string
  role: string | null
  departmentScopeIds: string[] | null
  fileAlias?: string
}): SQL {
  const f = sql.raw(input.fileAlias ?? 'f')
  if (input.role === 'admin') return sql`true`

  const memberExists = sql`exists (
    select 1
    from project_members pm_scope
    where pm_scope.project_id = ${f}."project_id"
      and pm_scope.project_stage = ${f}."project_stage"
      and pm_scope.user_id = ${input.userId}
      and pm_scope.is_active = true
      and pm_scope.deleted_at is null
  )`

  if (input.departmentScopeIds == null) {
    return sql`(
      ${f}."uploader_id" = ${input.userId}
      or ${memberExists}
      or ${f}."department_id" is not null
    )`
  }

  if (input.departmentScopeIds.length === 0) {
    return sql`(
      ${f}."uploader_id" = ${input.userId}
      or ${memberExists}
    )`
  }

  return sql`(
    ${f}."uploader_id" = ${input.userId}
    or ${memberExists}
    or ${f}."department_id" = any(${uuidArraySql(input.departmentScopeIds)})
  )`
}

export function buildCanAccessContentSql(input: {
  userId: string
  role: string | null
  departmentScopeIds: string[] | null
  fileAlias?: string
}): SQL {
  const f = sql.raw(input.fileAlias ?? 'f')
  if (input.role === 'admin') return sql`true`

  const memberExists = sql`exists (
    select 1
    from project_members pm_content
    where pm_content.project_id = ${f}."project_id"
      and pm_content.project_stage = ${f}."project_stage"
      and pm_content.user_id = ${input.userId}
      and pm_content.is_active = true
      and pm_content.deleted_at is null
  )`

  const roleCanDept = Boolean(
    input.role && CONFIDENTIAL_DEPARTMENT_CONTENT_ROLES.has(input.role)
  )
  const inDeptScope =
    input.departmentScopeIds == null
      ? sql`${f}."department_id" is not null`
      : input.departmentScopeIds.length > 0
        ? sql`${f}."department_id" = any(${uuidArraySql(input.departmentScopeIds)})`
        : sql`false`

  return sql`(
    ${f}."is_confidential" is not true
    or ${f}."uploader_id" = ${input.userId}
    or ${memberExists}
    or (${roleCanDept} = true and ${inDeptScope})
  )`
}
