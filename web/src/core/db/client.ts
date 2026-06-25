/**
 * Drizzle + postgres-js 连接（单例，懒加载）。
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type Db = ReturnType<typeof createDb>

function createDb(url: string) {
  // prepare:false 兼容连接池/PgBouncer transaction 模式
  const client = postgres(url, { prepare: false })
  return drizzle(client, { schema, casing: 'snake_case' })
}

let _db: Db | null = null

export function getDb(): Db {
  if (_db) return _db
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL 未配置（自建 PostgreSQL 连接串）')
  }
  _db = createDb(url)
  return _db
}

export { schema }
