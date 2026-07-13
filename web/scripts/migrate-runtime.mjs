import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('[migrate] DATABASE_URL is required')
  process.exit(1)
}

const migrationsFolder =
  process.env.DRIZZLE_MIGRATIONS_FOLDER || './src/core/db/migrations'

const client = postgres(databaseUrl, { max: 1, prepare: false })
const db = drizzle(client, { casing: 'snake_case' })

try {
  console.log(`[migrate] applying migrations from ${migrationsFolder}`)
  await migrate(db, { migrationsFolder })
  console.log('[migrate] done')
} finally {
  await client.end()
}
