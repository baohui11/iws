/**
 * 统一错误体系（应用层唯一来源）。
 *
 * 设计：每个错误带稳定 `code` 与 `expose`（是否可安全展示给用户），
 * 并能映射到 HTTP 状态码，方便将来对外 REST 接口直接复用。
 */

export type ErrorCode =
  | 'UNAUTHORIZED' // 未登录
  | 'FORBIDDEN' // 已登录但无权限
  | 'VALIDATION' // 入参校验失败
  | 'NOT_FOUND' // 资源不存在
  | 'CONFLICT' // 唯一约束 / 状态冲突
  | 'BUSINESS' // 业务规则不允许
  | 'INTERNAL' // 未预期错误（不暴露细节）

const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS: 422,
  INTERNAL: 500,
}

export class AppError extends Error {
  readonly code: ErrorCode
  /** 是否可将 message 安全展示给最终用户 */
  readonly expose: boolean

  constructor(message: string, code: ErrorCode = 'INTERNAL', expose = true) {
    super(message)
    this.name = new.target.name
    this.code = code
    this.expose = expose
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code]
  }
}

/** 未登录或无权限 */
export class AuthError extends AppError {
  constructor(
    message = '请先登录',
    code: Extract<ErrorCode, 'UNAUTHORIZED' | 'FORBIDDEN'> = 'UNAUTHORIZED'
  ) {
    super(message, code, true)
  }
}

/** 入参校验失败 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION', true)
  }
}

/** 资源不存在 */
export class NotFoundError extends AppError {
  constructor(message = '数据不存在') {
    super(message, 'NOT_FOUND', true)
  }
}

/** 业务规则不允许 */
export class BusinessError extends AppError {
  constructor(
    message: string,
    code: Extract<ErrorCode, 'BUSINESS' | 'CONFLICT'> = 'BUSINESS'
  ) {
    super(message, code, true)
  }
}
