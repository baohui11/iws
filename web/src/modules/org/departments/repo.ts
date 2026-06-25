import { and, asc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { departments, users } from '@/core/db/schema'

export interface DepartmentNode {
  id: string
  name: string
  parent_id: string | null
  code: string
  level: number | null
  children?: DepartmentNode[]
}

export interface DepartmentAdminRow {
  id: string
  code: string
  name: string
  parent_id: string | null
  level: number | null
  created_at: string
  deleted_at: string | null
}

export interface DepartmentWithRelations extends DepartmentAdminRow {
  parent_name: string | null
  leader_name: string | null
  leader_email: string | null
}

export interface DepartmentListParams {
  page?: number
  pageSize?: number
  keyword?: string
}

export interface DepartmentListResult {
  departments: DepartmentWithRelations[]
  total: number
  page: number
  pageSize: number
}

export interface InsertDepartmentData {
  code: string
  name: string
  parent_id: string | null
  level: number | null
}

export interface UpdateDepartmentData {
  code?: string
  name?: string
  parent_id?: string | null
  level?: number | null
}

function toIso(d: Date | string | null): string | null {
  if (d == null) return null
  return d instanceof Date ? d.toISOString() : d
}

export async function findDepartmentIdByName(
  departmentName: string
): Promise<string | null> {
  if (!departmentName?.trim()) return null
  const db = getDb()
  const rows = await db
    .select({ id: departments.id })
    .from(departments)
    .where(
      and(eq(departments.name, departmentName.trim()), isNull(departments.deletedAt))
    )
    .limit(1)
  return rows[0]?.id ?? null
}

export async function getDepartmentIdsForListFilter(
  departmentId: string
): Promise<string[]> {
  const db = getDb()
  const list = await db
    .select({ id: departments.id, parent_id: departments.parentId })
    .from(departments)
    .where(isNull(departments.deletedAt))

  const self = list.find((r) => r.id === departmentId)
  if (!self) return [departmentId]
  if (self.parent_id != null) return [self.id]

  const childrenByParent = new Map<string, string[]>()
  for (const r of list) {
    if (r.parent_id) {
      const arr = childrenByParent.get(r.parent_id) ?? []
      arr.push(r.id)
      childrenByParent.set(r.parent_id, arr)
    }
  }
  const ids: string[] = [self.id]
  const stack = [...(childrenByParent.get(self.id) ?? [])]
  while (stack.length) {
    const id = stack.pop()!
    ids.push(id)
    const kids = childrenByParent.get(id)
    if (kids) stack.push(...kids)
  }
  return ids
}

export async function getDepartmentTree(): Promise<DepartmentNode[]> {
  const db = getDb()
  const data = await db
    .select({
      id: departments.id,
      name: departments.name,
      parent_id: departments.parentId,
      code: departments.code,
      level: departments.level,
    })
    .from(departments)
    .where(isNull(departments.deletedAt))
    .orderBy(asc(departments.code))

  const roots = data.filter((d) => d.parent_id == null)
  const childrenByParent = new Map<string, DepartmentNode[]>()
  for (const d of data) {
    if (d.parent_id == null) continue
    const bucket = childrenByParent.get(d.parent_id) ?? []
    bucket.push({ ...d })
    childrenByParent.set(d.parent_id, bucket)
  }
  return roots.map((r) => ({ ...r, children: childrenByParent.get(r.id) ?? [] }))
}

export async function getRootDepartments() {
  const db = getDb()
  return db
    .select({ id: departments.id, name: departments.name, code: departments.code })
    .from(departments)
    .where(and(isNull(departments.deletedAt), isNull(departments.parentId)))
    .orderBy(asc(departments.code))
}

async function attachRelations(
  rows: DepartmentAdminRow[]
): Promise<DepartmentWithRelations[]> {
  const db = getDb()
  const parentIds = [
    ...new Set(rows.map((r) => r.parent_id).filter(Boolean)),
  ] as string[]
  const deptIds = rows.map((r) => r.id)

  const parentMap = new Map<string, string>()
  if (parentIds.length) {
    const ps = await db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(inArray(departments.id, parentIds))
    ps.forEach((p) => parentMap.set(p.id, p.name))
  }

  const ldsByDept = new Map<string, { name: string; email: string | null }[]>()
  if (deptIds.length) {
    const ldUsers = await db
      .select({
        name: users.name,
        email: users.email,
        department_id: users.departmentId,
      })
      .from(users)
      .where(
        and(
          inArray(users.departmentId, deptIds),
          eq(users.role, 'dept_ld'),
          isNull(users.deletedAt)
        )
      )
      .orderBy(asc(users.name))
    for (const u of ldUsers) {
      if (!u.department_id) continue
      const arr = ldsByDept.get(u.department_id) ?? []
      arr.push({ name: (u.name ?? '').trim() || '未命名', email: u.email })
      ldsByDept.set(u.department_id, arr)
    }
  }

  return rows.map((row) => {
    const list = ldsByDept.get(row.id) ?? []
    const names = list.map((x) => x.name).filter(Boolean)
    return {
      ...row,
      parent_name: row.parent_id ? parentMap.get(row.parent_id) ?? null : null,
      leader_name: names.length ? names.join('、') : null,
      leader_email: list.length === 1 ? list[0].email ?? null : null,
    }
  })
}

export async function getDepartmentList(
  params: DepartmentListParams = {}
): Promise<DepartmentListResult> {
  const { page = 1, pageSize = 20, keyword } = params
  const db = getDb()

  const where = keyword?.trim()
    ? and(
        isNull(departments.deletedAt),
        or(
          ilike(departments.name, `%${keyword.trim()}%`),
          ilike(departments.code, `%${keyword.trim()}%`)
        )
      )
    : isNull(departments.deletedAt)

  const [{ value: total }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(departments)
    .where(where)

  const data = await db
    .select({
      id: departments.id,
      code: departments.code,
      name: departments.name,
      parent_id: departments.parentId,
      level: departments.level,
      created_at: departments.createdAt,
      deleted_at: departments.deletedAt,
    })
    .from(departments)
    .where(where)
    .orderBy(asc(departments.code))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const rows: DepartmentAdminRow[] = data.map((d) => ({
    ...d,
    created_at: toIso(d.created_at)!,
    deleted_at: toIso(d.deleted_at),
  }))

  return {
    departments: await attachRelations(rows),
    total: total ?? 0,
    page,
    pageSize,
  }
}

export async function getDepartmentById(
  id: string
): Promise<DepartmentWithRelations | null> {
  const db = getDb()
  const data = await db
    .select({
      id: departments.id,
      code: departments.code,
      name: departments.name,
      parent_id: departments.parentId,
      level: departments.level,
      created_at: departments.createdAt,
      deleted_at: departments.deletedAt,
    })
    .from(departments)
    .where(and(eq(departments.id, id), isNull(departments.deletedAt)))
    .limit(1)

  if (!data[0]) return null
  const row: DepartmentAdminRow = {
    ...data[0],
    created_at: toIso(data[0].created_at)!,
    deleted_at: toIso(data[0].deleted_at),
  }
  const [withRel] = await attachRelations([row])
  return withRel
}

export async function insertDepartment(row: InsertDepartmentData): Promise<string> {
  const db = getDb()
  const inserted = await db
    .insert(departments)
    .values({
      code: row.code,
      name: row.name,
      parentId: row.parent_id,
      level: row.level,
    })
    .returning({ id: departments.id })
  return inserted[0].id
}

export async function updateDepartment(id: string, updates: UpdateDepartmentData) {
  const db = getDb()
  await db
    .update(departments)
    .set({
      ...(updates.code !== undefined ? { code: updates.code } : {}),
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.parent_id !== undefined ? { parentId: updates.parent_id } : {}),
      ...(updates.level !== undefined ? { level: updates.level } : {}),
    })
    .where(eq(departments.id, id))
}

export async function softDeleteDepartment(id: string) {
  const db = getDb()
  await db
    .update(departments)
    .set({ deletedAt: new Date() })
    .where(eq(departments.id, id))
}

export async function countChildDepartments(parentId: string): Promise<number> {
  const db = getDb()
  const [{ value }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(departments)
    .where(and(eq(departments.parentId, parentId), isNull(departments.deletedAt)))
  return value ?? 0
}
