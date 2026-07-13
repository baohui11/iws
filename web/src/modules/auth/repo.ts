import { and, eq, gt, isNull } from 'drizzle-orm'
import { getDb } from '@/core/db/client'
import { authEmailTokens, users } from '@/core/db/schema'

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

/** 按邮箱查未删除用户；忘记密码不要求已生效。 */
export async function findUserAuthByEmail(email: string) {
  const db = getDb()
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isActive: users.isActive,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1)
  return rows[0] ?? null
}

/** 按用户 id 查未删除启用用户（含密码哈希，仅供认证使用） */
export async function findActiveUserAuthById(userId: string) {
  const db = getDb()
  const rows = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(
      and(eq(users.id, userId), eq(users.isActive, true), isNull(users.deletedAt))
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

export async function createEmailToken(input: {
  userId: string
  purpose: 'invite' | 'password_reset'
  tokenHash: string
  expiresAt: Date
}) {
  const db = getDb()
  await db.insert(authEmailTokens).values({
    userId: input.userId,
    purpose: input.purpose,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
  })
}

export async function findValidEmailToken(input: {
  tokenHash: string
  purpose?: 'invite' | 'password_reset'
}) {
  const db = getDb()
  const conditions = [
    eq(authEmailTokens.tokenHash, input.tokenHash),
    isNull(authEmailTokens.consumedAt),
    gt(authEmailTokens.expiresAt, new Date()),
  ]
  if (input.purpose) conditions.push(eq(authEmailTokens.purpose, input.purpose))

  const rows = await db
    .select({
      id: authEmailTokens.id,
      userId: authEmailTokens.userId,
      purpose: authEmailTokens.purpose,
      email: users.email,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
    })
    .from(authEmailTokens)
    .innerJoin(users, eq(users.id, authEmailTokens.userId))
    .where(and(...conditions, isNull(users.deletedAt)))
    .limit(1)
  return rows[0] ?? null
}

export async function consumeEmailTokenAndSetPassword(input: {
  tokenId: string
  userId: string
  passwordHash: string
  activateUser?: boolean
}) {
  const db = getDb()
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash: input.passwordHash,
        ...(input.activateUser ? { isActive: true } : {}),
      })
      .where(eq(users.id, input.userId))
    await tx
      .update(authEmailTokens)
      .set({ consumedAt: new Date() })
      .where(eq(authEmailTokens.id, input.tokenId))
  })
}
