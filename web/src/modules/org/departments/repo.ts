import { and, asc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { departments, userDataScopes, users } from '@/core/db/schema'
import type { CurrentUser } from '@/core/auth'

export interface DepartmentNode {
  id: string
  name: string
  parent_id: string | null
  code: string
  level: number | null
  is_active: boolean
  children?: DepartmentNode[]
}

export interface DepartmentAdminRow {
  id: string
  code: string
  name: string
  parent_id: string | null
  level: number | null
  is_active: boolean
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

export interface OaDepartmentSyncData {
  code: string
  name: string
  parentCode: string | null
  level: number | null
  deletedAt: Date | null
}

export interface MissingDepartmentParent {
  code: string
  parentCode: string
}

export interface OaDepartmentSyncResult {
  pulledCount: number
  createdCount: number
  updatedCount: number
  parentUpdatedCount: number
  unchangedCount: number
  deletedCount: number
  missingParents: MissingDepartmentParent[]
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
  departmentId: string,
  options: { includeInactive?: boolean } = {}
): Promise<string[]> {
  const db = getDb()
  const where = options.includeInactive
    ? isNull(departments.deletedAt)
    : and(isNull(departments.deletedAt), eq(departments.isActive, true))
  const list = await db
    .select({
      id: departments.id,
      parent_id: departments.parentId,
    })
    .from(departments)
    .where(where)

  const self = list.find((r) => r.id === departmentId)
  if (!self) return []
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

export async function getAdminDepartmentScopeIds(
  user: Pick<CurrentUser, 'id' | 'role' | 'departmentId'>,
  options: { includeInactive?: boolean } = {}
): Promise<string[] | null> {
  if (user.role === 'admin') return null

  const db = getDb()
  const scopes = await db
    .select({
      scope_type: userDataScopes.scopeType,
      department_id: userDataScopes.departmentId,
    })
    .from(userDataScopes)
    .where(and(eq(userDataScopes.userId, user.id), isNull(userDataScopes.deletedAt)))

  if (scopes.some((scope) => scope.scope_type === 'all')) return null

  const seedIds = [
    user.departmentId,
    ...scopes
      .filter((scope) => scope.scope_type === 'department')
      .map((scope) => scope.department_id),
  ].filter((id): id is string => Boolean(id))

  const ids = new Set<string>()
  for (const id of seedIds) {
    const expanded = await getDepartmentIdsForListFilter(id, options)
    expanded.forEach((deptId) => ids.add(deptId))
  }
  return [...ids]
}

export async function getDepartmentTree(
  options: {
    includeInactive?: boolean
    allowedDepartmentIds?: string[] | null
  } = {}
): Promise<DepartmentNode[]> {
  const db = getDb()
  const conds = [isNull(departments.deletedAt)]
  if (!options.includeInactive) conds.push(eq(departments.isActive, true))
  if (options.allowedDepartmentIds) {
    conds.push(
      inArray(
        departments.id,
        options.allowedDepartmentIds.length ? options.allowedDepartmentIds : ['']
      )
    )
  }
  const data = await db
    .select({
      id: departments.id,
      name: departments.name,
      parent_id: departments.parentId,
      code: departments.code,
      level: departments.level,
      is_active: departments.isActive,
    })
    .from(departments)
    .where(and(...conds))
    .orderBy(asc(departments.code))

  const departmentIds = new Set(data.map((d) => d.id))
  const roots = data.filter(
    (d) => d.parent_id == null || !departmentIds.has(d.parent_id)
  )
  const childrenByParent = new Map<string, DepartmentNode[]>()
  for (const d of data) {
    if (d.parent_id == null) continue
    const bucket = childrenByParent.get(d.parent_id) ?? []
    bucket.push({ ...d })
    childrenByParent.set(d.parent_id, bucket)
  }
  return roots.map((r) => ({ ...r, children: childrenByParent.get(r.id) ?? [] }))
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
          eq(users.isDeptLeader, true),
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
      is_active: departments.isActive,
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
      is_active: departments.isActive,
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

export async function updateDepartmentActive(id: string, isActive: boolean) {
  const db = getDb()
  await db
    .update(departments)
    .set({ isActive })
    .where(eq(departments.id, id))
}

export async function syncDepartmentsFromOa(
  rows: OaDepartmentSyncData[]
): Promise<OaDepartmentSyncResult> {
  const db = getDb()
  const codes = [...new Set(rows.map((row) => row.code))]
  if (codes.length === 0) {
    return {
      pulledCount: 0,
      createdCount: 0,
      updatedCount: 0,
      parentUpdatedCount: 0,
      unchangedCount: 0,
      deletedCount: 0,
      missingParents: [],
    }
  }

  return db.transaction(async (tx) => {
    const existingRows = await tx
      .select({
        id: departments.id,
        code: departments.code,
        name: departments.name,
        parentId: departments.parentId,
        level: departments.level,
        deletedAt: departments.deletedAt,
      })
      .from(departments)
      .where(inArray(departments.code, codes))

    const existingByCode = new Map(existingRows.map((row) => [row.code, row]))
    const changedCodes = new Set<string>()
    let createdCount = 0
    let updatedCount = 0

    for (const row of rows) {
      const existing = existingByCode.get(row.code)
      if (!existing) {
        const inserted = await tx
          .insert(departments)
          .values({
            code: row.code,
            name: row.name,
            parentId: null,
            level: row.level,
            deletedAt: row.deletedAt,
          })
          .returning({
            id: departments.id,
            code: departments.code,
            name: departments.name,
            parentId: departments.parentId,
            level: departments.level,
            deletedAt: departments.deletedAt,
          })
        existingByCode.set(row.code, inserted[0])
        changedCodes.add(row.code)
        createdCount += 1
        continue
      }

      const needsUpdate =
        existing.name !== row.name ||
        existing.level !== row.level ||
        !sameNullableDate(existing.deletedAt, row.deletedAt)

      if (!needsUpdate) continue

      const updated = await tx
        .update(departments)
        .set({
          name: row.name,
          level: row.level,
          deletedAt: row.deletedAt,
        })
        .where(eq(departments.id, existing.id))
        .returning({
          id: departments.id,
          code: departments.code,
          name: departments.name,
          parentId: departments.parentId,
          level: departments.level,
          deletedAt: departments.deletedAt,
        })
      existingByCode.set(row.code, updated[0])
      changedCodes.add(row.code)
      updatedCount += 1
    }

    const missingParents: MissingDepartmentParent[] = []
    let parentUpdatedCount = 0

    for (const row of rows) {
      const existing = existingByCode.get(row.code)
      if (!existing) continue

      let parentId: string | null = null
      if (row.parentCode) {
        const parent = existingByCode.get(row.parentCode)
        if (!parent) {
          missingParents.push({ code: row.code, parentCode: row.parentCode })
          continue
        }
        parentId = parent.id
      }

      if (existing.parentId === parentId) continue

      await tx
        .update(departments)
        .set({ parentId })
        .where(eq(departments.id, existing.id))
      changedCodes.add(row.code)
      parentUpdatedCount += 1
      existingByCode.set(row.code, { ...existing, parentId })
    }

    return {
      pulledCount: rows.length,
      createdCount,
      updatedCount,
      parentUpdatedCount,
      unchangedCount: rows.length - changedCodes.size,
      deletedCount: rows.filter((row) => row.deletedAt != null).length,
      missingParents,
    }
  })
}
