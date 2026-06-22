// AuthError       → 没登录、没权限
// ValidationError → 参数校验失败
// NotFoundError   → 数据不存在
// BusinessError   → 业务规则不允许
// 其他未捕获错误  → 意外错误，不暴露给用户

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class BusinessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BusinessError'
  }
}
