import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { users } from '@/core/db/schema'

/** 按邮箱查未删除用户（含密码哈希，仅供认证使用） */
export async function findActiveUserByEmail(email: string) {
  const db = getDb()
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(
      and(eq(users.email, email), eq(users.isActive, true), isNull(users.deletedAt))
    )
    .limit(1)
  return rows[0] ?? null
}

/** 更新指定用户的密码哈希 */
export async function updatePasswordById(
  userId: string,
  passwordHash: string
): Promise<void> {
  const db = getDb()
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId))
}
