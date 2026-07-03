import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { departments, userDataScopes, users } from '@/core/db/schema'
import { getDepartmentIdsForListFilter } from '@/modules/org/departments/repo'
import type { SystemRoleValue } from '@/constants/system-roles'

export type SystemRole = SystemRoleValue

export interface UserRow {
  id: string
  email: string | null
  name: string | null
  gender: string | null
  employee_no: string | null
  department_id: string | null
  position: string | null
  role: SystemRole | null
  tags: string | null
  avatar_url: string | null
  is_active: boolean
  is_dept_leader: boolean
  created_at: string
  deleted_at: string | null
}

export interface UserWithDepartment extends UserRow {
  department_name: string
}

export interface UserDataScopeRow {
  id: string
  user_id?: string
  user_name?: string | null
  employee_no?: string | null
  user_department_name?: string | null
  scope_type: 'department' | 'all'
  department_id: string | null
  department_name: string | null
  include_children: boolean
}

export interface UserDataScopeInput {
  scope_type: 'department' | 'all'
  department_id?: string | null
  include_children?: boolean
}

export interface UpdateUserData {
  name?: string
  gender?: string
  employee_no?: string
  department_id?: string
  position?: string
  role?: SystemRole
  tags?: string | null
  email?: string
  is_active?: boolean
}

export interface OaUserSyncData {
  email: string | null
  name: string
  employeeNo: string
  gender: string | null
  position: string | null
  departmentCode: string | null
  isDeptLeader: boolean
  deletedAt: Date | null
}

export interface OaUserMissingDepartment {
  employeeNo: string
  departmentCode: string
}

export interface OaUserSyncResult {
  pulledCount: number
  createdCount: number
  updatedCount: number
  unchangedCount: number
  deletedCount: number
  missingDepartments: OaUserMissingDepartment[]
}

export interface UserListParams {
  page?: number
  pageSize?: number
  keyword?: string
  department_id?: string
  role?: SystemRole
  tags?: string
  allowed_department_ids?: string[] | null
}

export interface UserListResult {
  users: UserWithDepartment[]
  total: number
  page: number
  pageSize: number
}

function toIso(d: Date | string | null): string | null {
  if (d == null) return null
  return d instanceof Date ? d.toISOString() : d
}

function sameNullableDate(a: Date | string | null, b: Date | null): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  const left = a instanceof Date ? a : new Date(a)
  return left.getTime() === b.getTime()
}

const baseColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  gender: users.gender,
  employee_no: users.employeeNo,
  department_id: users.departmentId,
  position: users.position,
  role: users.role,
  tags: users.tags,
  avatar_url: users.avatarUrl,
  is_active: users.isActive,
  is_dept_leader: users.isDeptLeader,
  created_at: users.createdAt,
  deleted_at: users.deletedAt,
  department_name: departments.name,
}

function mapRow(r: Record<string, unknown>): UserWithDepartment {
  return {
    id: r.id as string,
    email: (r.email as string | null) ?? null,
    name: (r.name as string | null) ?? null,
    gender: (r.gender as string | null) ?? null,
    employee_no: (r.employee_no as string | null) ?? null,
    department_id: (r.department_id as string | null) ?? null,
    position: (r.position as string | null) ?? null,
    role: (r.role as SystemRole | null) ?? null,
    tags: (r.tags as string | null) ?? null,
    avatar_url: (r.avatar_url as string | null) ?? null,
    is_active: Boolean(r.is_active),
    is_dept_leader: Boolean(r.is_dept_leader),
    created_at: toIso(r.created_at as Date | string | null)!,
    deleted_at: toIso(r.deleted_at as Date | string | null),
    department_name: (r.department_name as string | null) ?? '',
  }
}

export async function findUserIdByEmployeeNo(
  employeeNo: string
): Promise<string | null> {
  if (!employeeNo?.trim()) return null
  const db = getDb()
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.employeeNo, employeeNo.trim()), isNull(users.deletedAt)))
    .limit(1)
  return rows[0]?.id ?? null
}

export async function getUserById(
  id: string
): Promise<UserWithDepartment | null> {
  const db = getDb()
  const rows = await db
    .select(baseColumns)
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1)
  return rows[0] ? mapRow(rows[0]) : null
}

export async function getUserList(
  params: UserListParams = {}
): Promise<UserListResult> {
  const {
    page = 1,
    pageSize = 20,
    keyword,
    department_id,
    role,
    tags,
    allowed_department_ids,
  } = params
  const db = getDb()

  const conds = [isNull(users.deletedAt)]
  if (keyword?.trim()) {
    conds.push(
      or(
        ilike(users.name, `%${keyword.trim()}%`),
        ilike(users.employeeNo, `%${keyword.trim()}%`)
      )!
    )
  }
  if (department_id) {
    const deptIds = await getDepartmentIdsForListFilter(department_id, {
      includeInactive: true,
    })
    conds.push(inArray(users.departmentId, deptIds.length ? deptIds : ['']))
  }
  if (allowed_department_ids) {
    conds.push(
      inArray(
        users.departmentId,
        allowed_department_ids.length ? allowed_department_ids : ['']
      )
    )
  }
  if (role) {
    conds.push(eq(users.role, role))
  }
  if (tags?.trim()) {
    conds.push(ilike(users.tags, `%${tags.trim()}%`))
  }
  const where = and(...conds)

  const [{ value: total }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(users)
    .where(where)

  const rows = await db
    .select(baseColumns)
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    users: rows.map(mapRow),
    total: total ?? 0,
    page,
    pageSize,
  }
}

export async function searchUsersForDataScopePick(params: {
  keyword?: string
  limit?: number
} = {}): Promise<UserWithDepartment[]> {
  const { keyword, limit = 50 } = params
  const db = getDb()
  const conds = [isNull(users.deletedAt)]
  const trimmedKeyword = keyword?.trim()

  if (trimmedKeyword) {
    conds.push(
      or(
        ilike(users.name, `%${trimmedKeyword}%`),
        ilike(users.employeeNo, `%${trimmedKeyword}%`),
        ilike(users.email, `%${trimmedKeyword}%`)
      )!
    )
  }

  const rows = await db
    .select(baseColumns)
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(...conds))
    .orderBy(asc(users.name), asc(users.employeeNo))
    .limit(Math.min(Math.max(limit, 1), 100))

  return rows.map(mapRow)
}

export async function listUserDataScopes(
  userId: string
): Promise<UserDataScopeRow[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: userDataScopes.id,
      scope_type: userDataScopes.scopeType,
      department_id: userDataScopes.departmentId,
      department_name: departments.name,
      include_children: userDataScopes.includeChildren,
    })
    .from(userDataScopes)
    .leftJoin(departments, eq(userDataScopes.departmentId, departments.id))
    .where(
      and(eq(userDataScopes.userId, userId), isNull(userDataScopes.deletedAt))
    )
    .orderBy(userDataScopes.scopeType, departments.name)

  return rows.map((row) => ({
    id: row.id,
    scope_type: row.scope_type,
    department_id: row.department_id,
    department_name: row.department_name ?? null,
    include_children: row.include_children,
  }))
}

export async function listAllUserDataScopes(): Promise<UserDataScopeRow[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: userDataScopes.id,
      user_id: userDataScopes.userId,
      user_name: users.name,
      employee_no: users.employeeNo,
      user_department_id: users.departmentId,
      scope_type: userDataScopes.scopeType,
      department_id: userDataScopes.departmentId,
      department_name: departments.name,
      include_children: userDataScopes.includeChildren,
    })
    .from(userDataScopes)
    .innerJoin(users, eq(userDataScopes.userId, users.id))
    .leftJoin(departments, eq(userDataScopes.departmentId, departments.id))
    .where(and(isNull(userDataScopes.deletedAt), isNull(users.deletedAt)))
    .orderBy(desc(userDataScopes.createdAt))

  const userDepartmentIds = [
    ...new Set(
      rows
        .map((row) => row.user_department_id)
        .filter((id): id is string => id != null)
    ),
  ]
  const userDepartmentRows = userDepartmentIds.length
    ? await db
        .select({ id: departments.id, name: departments.name })
        .from(departments)
        .where(inArray(departments.id, userDepartmentIds))
    : []
  const userDepartmentNameById = new Map(
    userDepartmentRows.map((row) => [row.id, row.name])
  )

  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name,
    employee_no: row.employee_no,
    user_department_name: row.user_department_id
      ? userDepartmentNameById.get(row.user_department_id) ?? null
      : null,
    scope_type: row.scope_type,
    department_id: row.department_id,
    department_name: row.department_name ?? null,
    include_children: row.include_children,
  }))
}

export async function replaceUserDataScopes(
  userId: string,
  scopes: UserDataScopeInput[]
) {
  const db = getDb()
  await db.transaction(async (tx) => {
    await tx
      .update(userDataScopes)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(userDataScopes.userId, userId),
          isNull(userDataScopes.deletedAt)
        )
      )

    const hasAll = scopes.some((scope) => scope.scope_type === 'all')
    const rows = hasAll
      ? [
          {
            userId,
            scopeType: 'all' as const,
            departmentId: null,
            includeChildren: true,
          },
        ]
      : [
          ...new Set(
            scopes
              .filter((scope) => scope.scope_type === 'department')
              .map((scope) => scope.department_id?.trim())
              .filter((id): id is string => Boolean(id))
          ),
        ].map((departmentId) => ({
          userId,
          scopeType: 'department' as const,
          departmentId,
          includeChildren: true,
        }))

    if (rows.length > 0) {
      await tx.insert(userDataScopes).values(rows)
    }
  })
}

export async function updateUserRow(id: string, updates: UpdateUserData) {
  const db = getDb()
  await db
    .update(users)
    .set({
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.gender !== undefined ? { gender: updates.gender } : {}),
      ...(updates.employee_no !== undefined
        ? { employeeNo: updates.employee_no }
        : {}),
      ...(updates.department_id !== undefined
        ? { departmentId: updates.department_id }
        : {}),
      ...(updates.position !== undefined ? { position: updates.position } : {}),
      ...(updates.role !== undefined ? { role: updates.role } : {}),
      ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
      ...(updates.email !== undefined ? { email: updates.email } : {}),
      ...(updates.is_active !== undefined ? { isActive: updates.is_active } : {}),
    })
    .where(eq(users.id, id))
}

export async function listUsersForLeaderPick() {
  const db = getDb()
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(isNull(users.deletedAt))
    .orderBy(users.name)
    .limit(500)
}

/** 更新头像对象路径 */
export async function updateAvatarById(userId: string, path: string) {
  const db = getDb()
  await db.update(users).set({ avatarUrl: path }).where(eq(users.id, userId))
}

export async function syncUsersFromOa(
  rows: OaUserSyncData[]
): Promise<OaUserSyncResult> {
  const db = getDb()
  const employeeNos = [...new Set(rows.map((row) => row.employeeNo))]
  if (employeeNos.length === 0) {
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
  const departmentRows = departmentCodes.length
    ? await db
        .select({ id: departments.id, code: departments.code })
        .from(departments)
        .where(inArray(departments.code, departmentCodes))
    : []
  const departmentIdByCode = new Map(
    departmentRows.map((row) => [row.code, row.id])
  )

  const existingRows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      gender: users.gender,
      employeeNo: users.employeeNo,
      departmentId: users.departmentId,
      position: users.position,
      isDeptLeader: users.isDeptLeader,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(inArray(users.employeeNo, employeeNos))

  const existingByEmployeeNo = new Map(
    existingRows
      .filter((row) => row.employeeNo != null)
      .map((row) => [row.employeeNo!, row])
  )
  const missingDepartments: OaUserMissingDepartment[] = []
  let createdCount = 0
  let updatedCount = 0
  let unchangedCount = 0

  for (const row of rows) {
    const departmentId = row.departmentCode
      ? departmentIdByCode.get(row.departmentCode) ?? null
      : null
    if (row.departmentCode && !departmentId) {
      missingDepartments.push({
        employeeNo: row.employeeNo,
        departmentCode: row.departmentCode,
      })
    }

    const existing = existingByEmployeeNo.get(row.employeeNo)
    if (!existing) {
      const inserted = await db
        .insert(users)
        .values({
          email: row.email,
          name: row.name,
          gender: row.gender,
          employeeNo: row.employeeNo,
          departmentId,
          position: row.position,
          isDeptLeader: row.isDeptLeader,
          deletedAt: row.deletedAt,
          isActive: false,
          role: 'user',
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          gender: users.gender,
          employeeNo: users.employeeNo,
          departmentId: users.departmentId,
          position: users.position,
          isDeptLeader: users.isDeptLeader,
          deletedAt: users.deletedAt,
        })
      existingByEmployeeNo.set(row.employeeNo, inserted[0])
      createdCount += 1
      continue
    }

    const needsUpdate =
      existing.email !== row.email ||
      existing.name !== row.name ||
      existing.gender !== row.gender ||
      existing.departmentId !== departmentId ||
      existing.position !== row.position ||
      existing.isDeptLeader !== row.isDeptLeader ||
      !sameNullableDate(existing.deletedAt, row.deletedAt)

    if (!needsUpdate) {
      unchangedCount += 1
      continue
    }

    const updated = await db
      .update(users)
      .set({
        email: row.email,
        name: row.name,
        gender: row.gender,
        departmentId,
        position: row.position,
        isDeptLeader: row.isDeptLeader,
        deletedAt: row.deletedAt,
      })
      .where(eq(users.id, existing.id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        gender: users.gender,
        employeeNo: users.employeeNo,
        departmentId: users.departmentId,
        position: users.position,
        isDeptLeader: users.isDeptLeader,
        deletedAt: users.deletedAt,
      })
    existingByEmployeeNo.set(row.employeeNo, updated[0])
    updatedCount += 1
  }

  return {
    pulledCount: rows.length,
    createdCount,
    updatedCount,
    unchangedCount,
    deletedCount: rows.filter((row) => row.deletedAt != null).length,
    missingDepartments,
  }
}
