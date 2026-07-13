import bcrypt from 'bcryptjs'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('[seed-admin] DATABASE_URL is required')
  process.exit(1)
}

const email = process.env.SEED_ADMIN_EMAIL || 'admin@iws.local'
const password = process.env.SEED_ADMIN_PASSWORD || 'admin12345'

const sql = postgres(databaseUrl, { max: 1, prepare: false })

try {
  const admins = await sql`
    select id, email
    from users
    where role = 'admin' and deleted_at is null
    limit 1
  `

  if (admins[0]) {
    console.log(`[seed-admin] admin exists: ${admins[0].email ?? admins[0].id}`)
    process.exit(0)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const users = await sql`
    select id
    from users
    where email = ${email}
    limit 1
  `

  if (users[0]) {
    await sql`
      update users
      set
        name = '系统管理员',
        role = 'admin',
        password_hash = ${passwordHash},
        is_active = true,
        deleted_at = null
      where id = ${users[0].id}
    `
    console.log(`[seed-admin] promoted existing user: ${email}`)
  } else {
    await sql`
      insert into users (
        email,
        name,
        employee_no,
        role,
        password_hash,
        is_active
      )
      values (
        ${email},
        '系统管理员',
        'ADMIN',
        'admin',
        ${passwordHash},
        true
      )
    `
    console.log(`[seed-admin] created admin: ${email}`)
  }
} finally {
  await sql.end()
}
