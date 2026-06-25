import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { departments, users } from '@/core/db/schema'
import { getDepartmentIdsForListFilter } from '@/modules/org/departments/repo'
import type { SystemRoleValue } from '@/constants/system-roles'

export type SystemRole = SystemRoleValue

export interface InsertUserRow {
  email: string
  name: string
  gender: string
  employee_no: string
  department_id: string
  position: string
  role: SystemRole
}

export interface UserRow {
  id: string
  email: string | null
  name: string | null
  gender: string | null
  employee_no: string | null
  department_id: string | null
  position: string | null
  role: SystemRole | null
  avatar_url: string | null
  created_at: string
  deleted_at: string | null
}

export interface UserWithDepartment extends UserRow {
  department_name: string
}

export interface UpdateUserData {
  name?: string
  gender?: string
  employee_no?: string
  department_id?: string
  position?: string
  role?: SystemRole
  email?: string
}

export interface UserListParams {
  page?: number
  pageSize?: number
  keyword?: string
  department_id?: string
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

const baseColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  gender: users.gender,
  employee_no: users.employeeNo,
  department_id: users.departmentId,
  position: users.position,
  role: users.role,
  avatar_url: users.avatarUrl,
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
    avatar_url: (r.avatar_url as string | null) ?? null,
    created_at: toIso(r.created_at as Date | string | null)!,
    deleted_at: toIso(r.deleted_at as Date | string | null),
    department_name: (r.department_name as string | null) ?? '',
  }
}

/** 按工号 UPSERT：存在（含软删除）则恢复并更新，否则新增 */
export async function upsertUserByEmployeeNo(
  row: InsertUserRow
): Promise<string> {
  const db = getDb()
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.employeeNo, row.employee_no))
    .limit(1)

  if (existing[0]) {
    await db
      .update(users)
      .set({
        email: row.email,
        name: row.name,
        gender: row.gender,
        employeeNo: row.employee_no,
        departmentId: row.department_id,
        position: row.position,
        role: row.role,
        deletedAt: null,
      })
      .where(eq(users.id, existing[0].id))
    return existing[0].id
  }

  const inserted = await db
    .insert(users)
    .values({
      email: row.email,
      name: row.name,
      gender: row.gender,
      employeeNo: row.employee_no,
      departmentId: row.department_id,
      position: row.position,
      role: row.role,
    })
    .returning({ id: users.id })
  return inserted[0].id
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
  const { page = 1, pageSize = 20, keyword, department_id } = params
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
    const deptIds = await getDepartmentIdsForListFilter(department_id)
    conds.push(inArray(users.departmentId, deptIds.length ? deptIds : ['']))
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
      ...(updates.email !== undefined ? { email: updates.email } : {}),
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

/** 软删除：清空 email 避免唯一约束冲突 */
export async function softDeleteUserById(id: string) {
  const db = getDb()
  await db
    .update(users)
    .set({ deletedAt: new Date(), email: null })
    .where(eq(users.id, id))
}
