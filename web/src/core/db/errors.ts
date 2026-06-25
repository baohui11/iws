import { BusinessError } from '@/core/errors'

/** 将 PostgreSQL 错误码映射为业务错误（用于 repo/service 写操作的 catch）。 */
export function mapDbError(e: unknown): never {
  const code = (e as { code?: string })?.code
  switch (code) {
    case '23505':
      throw new BusinessError('数据已存在（唯一字段冲突）', 'CONFLICT')
    case '23503':
      throw new BusinessError('关联数据不存在')
    case '23502':
      throw new BusinessError('必填字段不能为空')
    default:
      throw e
  }
}
