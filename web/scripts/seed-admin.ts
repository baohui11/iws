/**
 * 创建初始管理员。运行：
 *   $env:DATABASE_URL="postgresql://iws:iws_dev_password@localhost:5432/iws"; pnpm db:seed
 * 若数据库中已经存在未删除 admin 用户，则不会重复创建。
 * 账号/密码来自 SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD（默认 admin@iws.local / admin12345）。
 */
import { and, eq, isNull } from 'drizzle-orm'
import { getDb } from '../src/core/db/client'
import { users } from '../src/core/db/schema'
import { hashPassword } from '../src/core/auth/password'

const email = process.env.SEED_ADMIN_EMAIL || 'admin@iws.local'
const password = process.env.SEED_ADMIN_PASSWORD || 'admin12345'

const db = getDb()
const existingAdmin = await db
  .select({ id: users.id, email: users.email })
  .from(users)
  .where(and(eq(users.role, 'admin'), isNull(users.deletedAt)))
  .limit(1)

if (existingAdmin[0]) {
  console.log(`管理员已存在：${existingAdmin[0].email ?? existingAdmin[0].id}`)
  process.exit(0)
}

const existingUser = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, email))
  .limit(1)

if (existingUser[0]) {
  await db
    .update(users)
    .set({
      name: '系统管理员',
      role: 'admin',
      passwordHash: await hashPassword(password),
      isActive: true,
      deletedAt: null,
    })
    .where(eq(users.id, existingUser[0].id))
  console.log(`已将现有用户设为管理员：${email}`)
  process.exit(0)
}

await db.insert(users).values({
  email,
  name: '系统管理员',
  employeeNo: 'ADMIN',
  role: 'admin',
  passwordHash: await hashPassword(password),
  isActive: true,
})

console.log(`已创建管理员：${email} / ${password}`)
process.exit(0)
