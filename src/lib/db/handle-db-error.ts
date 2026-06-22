import { AuthError, BusinessError, NotFoundError } from '@/lib/errors'

export function handleDbError(error: { code: string; message?: string }): never {
  switch (error.code) {
    case '23505':
      throw new BusinessError('数据已存在')

    case '23503':
      throw new BusinessError('关联数据不存在')

    case '23502':
      throw new BusinessError('必填字段不能为空')

    case '42501':
      throw new AuthError('没有操作权限')

    case 'PGRST116':
      throw new NotFoundError('数据不存在')

    default:
      throw error
  }
}
