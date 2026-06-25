/**
 * 创建初始管理员。运行：
 *   $env:DATABASE_URL="postgresql://iws:iws_dev_password@localhost:5432/iws"; pnpm db:seed
 * 账号/密码来自 SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD（默认 admin@iws.local / admin12345）。
 */
import { eq } from 'drizzle-orm'
import { getDb } from '../src/core/db/client'
import { users } from '../src/core/db/schema'
import { hashPassword } from '../src/core/auth/password'

const email = process.env.SEED_ADMIN_EMAIL || 'admin@iws.local'
const password = process.env.SEED_ADMIN_PASSWORD || 'admin12345'

const db = getDb()
const existing = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, email))
  .limit(1)

if (existing[0]) {
  console.log(`管理员已存在：${email}`)
  process.exit(0)
}

await db.insert(users).values({
  email,
  name: '系统管理员',
  role: 'admin',
  passwordHash: await hashPassword(password),
})

console.log(`已创建管理员：${email} / ${password}`)
process.exit(0)
