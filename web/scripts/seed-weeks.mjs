import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('[seed-weeks] DATABASE_URL is required')
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataPath =
  process.env.SEED_WEEKS_FILE ||
  path.join(__dirname, 'seed-data', 'weeks.json')

const sql = postgres(databaseUrl, { max: 1, prepare: false })

function readWeeks() {
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
  const rows = Array.isArray(raw) ? raw : raw.weeks
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('weeks seed file is empty or invalid')
  }
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    year: row.year,
    weekNo: row.week_no,
    weekCode: row.week_code,
    startDate: row.start_date,
    endDate: row.end_date,
    deadline: row.deadline,
    isLocked: Boolean(row.is_locked),
  }))
}

try {
  const existing = await sql`select count(*)::int as count from weeks`
  if ((existing[0]?.count ?? 0) > 0) {
    console.log(`[seed-weeks] weeks exists: ${existing[0].count}`)
    process.exit(0)
  }

  const rows = readWeeks()
  await sql.begin(async (tx) => {
    for (const row of rows) {
      await tx`
        insert into weeks (
          id,
          created_at,
          updated_at,
          year,
          week_no,
          week_code,
          start_date,
          end_date,
          deadline,
          is_locked
        )
        values (
          ${row.id},
          ${row.createdAt},
          ${row.updatedAt},
          ${row.year},
          ${row.weekNo},
          ${row.weekCode},
          ${row.startDate},
          ${row.endDate},
          ${row.deadline},
          ${row.isLocked}
        )
        on conflict (year, week_no) do nothing
      `
    }
  })

  const after = await sql`select count(*)::int as count from weeks`
  console.log(`[seed-weeks] inserted weeks: ${after[0]?.count ?? rows.length}`)
} finally {
  await sql.end()
}
