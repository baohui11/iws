/**
 * 应用层统一返回类型与执行包装。
 *
 * 传输层（tRPC / REST / Server Action）只需调用 `run(() => service(...))`，
 * 把领域错误转成稳定的 { success, code, message }，不泄露内部细节。
 */
import { AppError } from './errors'

export type Result<T> =
  | { success: true; data: T }
  | { success: false; code: string; message: string }

const GENERIC_MESSAGE = '操作失败，请稍后重试'

export async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { success: true, data: await fn() }
  } catch (e) {
    if (e instanceof AppError) {
      if (e.expose) {
        console.warn(`[${e.code}]`, e.message)
        return { success: false, code: e.code, message: e.message }
      }
      console.error(`[${e.code}]`, e)
      return { success: false, code: e.code, message: GENERIC_MESSAGE }
    }
    console.error('[INTERNAL]', e)
    return { success: false, code: 'INTERNAL', message: GENERIC_MESSAGE }
  }
}
