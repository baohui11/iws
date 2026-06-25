/**
 * 与「加密系统」HTTP 服务对接：登录后按路径对磁盘文件原地加解密。
 * 需与 `IWS_TEMP_DIR` 指向同一可被该服务访问的目录（例如 `@temp`）。
 *
 * 环境变量（服务端，勿加 NEXT_PUBLIC_）：
 * - IWS_ENCRYPT_BASE_URL — 服务根，如 `http://192.168.x.x:port`
 * - IWS_ENCRYPT_NAME / IWS_ENCRYPT_PASSWORD — 登录凭据
 * - IWS_ENCRYPT_TIMEOUT_MS — 可选，单次请求超时，默认 120000
 *
 * 未配置完整凭据时，上传/下载链不调用远程，直接读写临时文件（便于本地无加密服务开发）。
 */

interface EncryptionResponse {
  error: string
  desc?: string
  loginid?: string
}

const SESSION_EXPIRED_CODE = '61453'

const DEFAULT_SETTING = [
  { guid: '00000000-0000-0000-0000-000000000000', level: '0' },
]
const DEFAULT_ACCESS = [
  { guid: '00000000-0000-0000-0000-000000000000', level: '0' },
]

function getEncryptEnv() {
  const baseUrl = process.env.IWS_ENCRYPT_BASE_URL?.trim() ?? ''
  const name = process.env.IWS_ENCRYPT_NAME?.trim() ?? ''
  const password = process.env.IWS_ENCRYPT_PASSWORD ?? ''
  const timeoutMs = Number(process.env.IWS_ENCRYPT_TIMEOUT_MS ?? '120000') || 120000
  return { baseUrl, name, password, timeoutMs }
}

export function isEncryptSystemConfigured(): boolean {
  const { baseUrl, name, password } = getEncryptEnv()
  return Boolean(baseUrl && name && password.length > 0)
}

/** 部分接口要求路径为 `/` 分隔 */
function pathForApi(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

class EncryptClient {
  private loginId: string | null = null
  private loginLock: Promise<string> | null = null

  async getLoginId(): Promise<string> {
    if (this.loginId) return this.loginId
    if (!this.loginLock) {
      this.loginLock = this.login().finally(() => {
        this.loginLock = null
      })
    }
    return this.loginLock
  }

  private async login(): Promise<string> {
    const { baseUrl, name, password, timeoutMs } = getEncryptEnv()
    const res = await this.sendRequest(
      'login',
      { Name: name, Password: password },
      baseUrl,
      timeoutMs
    )

    if (res.error !== '0' || !res.loginid) {
      throw new Error(
        `加密系统登录失败: ${res.desc ?? res.error}`
      )
    }

    this.loginId = res.loginid
    return this.loginId
  }

  async decryptFile(filePath: string): Promise<void> {
    const { baseUrl, timeoutMs } = getEncryptEnv()
    const loginId = await this.getLoginId()
    const body = { LoginID: loginId, File: pathForApi(filePath) }
    await this.callWithRetry(
      'decryptFile',
      body,
      baseUrl,
      timeoutMs,
      (retryBody, newLoginId) => {
        ;(retryBody as { LoginID: string }).LoginID = newLoginId
      }
    )
  }

  async encryptFile(filePath: string): Promise<void> {
    const { baseUrl, timeoutMs } = getEncryptEnv()
    const loginId = await this.getLoginId()
    const body = {
      LoginID: loginId,
      Param: {
        files: [pathForApi(filePath)],
        setting: DEFAULT_SETTING,
        access: DEFAULT_ACCESS,
      },
    }
    await this.callWithRetry(
      'encryptFile',
      body,
      baseUrl,
      timeoutMs,
      (retryBody, newLoginId) => {
        ;(retryBody as { LoginID: string }).LoginID = newLoginId
      }
    )
  }

  private async callWithRetry(
    endpoint: string,
    body: Record<string, unknown>,
    baseUrl: string,
    timeoutMs: number,
    patchLoginId: (body: Record<string, unknown>, newLoginId: string) => void
  ): Promise<void> {
    let res = await this.sendRequest(endpoint, body, baseUrl, timeoutMs)

    if (res.error === SESSION_EXPIRED_CODE) {
      this.loginId = null
      const newLoginId = await this.getLoginId()
      patchLoginId(body, newLoginId)
      res = await this.sendRequest(endpoint, body, baseUrl, timeoutMs)
    }

    if (res.error !== '0') {
      throw new Error(
        `${endpoint} 失败: ${res.desc ?? `错误码 ${res.error}`}`
      )
    }
  }

  private async sendRequest(
    callFunction: string,
    requestData: unknown,
    baseUrl: string,
    timeoutMs: number
  ): Promise<EncryptionResponse> {
    const url = `${baseUrl.replace(/\/$/, '')}/${callFunction}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`${callFunction} HTTP ${response.status}`)
      }
      return (await response.json()) as EncryptionResponse
    } finally {
      clearTimeout(timeout)
    }
  }
}

export const encryptClient = new EncryptClient()
