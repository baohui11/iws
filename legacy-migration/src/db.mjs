import postgres from '../../web/node_modules/postgres/src/index.js'

export function connectLegacy(config) {
  return postgres(config.legacyDatabaseUrl, { max: 1, connect_timeout: 10 })
}

export function connectTarget(config) {
  return postgres(config.targetDatabaseUrl, { max: 1, connect_timeout: 10 })
}

export async function closeDb(sql) {
  if (sql) await sql.end({ timeout: 5 }).catch(() => {})
}

export async function tableCount(sql, schema, table) {
  const rows = await sql`select count(*)::int as count from ${sql(schema)}.${sql(table)}`
  return rows[0]?.count ?? 0
}
