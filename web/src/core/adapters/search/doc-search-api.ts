import { BusinessError } from '@/core/errors'
import type { DocSearchRequestBody, DocSearchResponse } from '@/modules/files/types'

function getSearchApiBaseUrl(): string {
  const direct =
    process.env.SEARCH_API_BASE_URL?.trim() ||
    process.env.SEARCH_SERVICE_URL?.trim()
  if (direct) return direct.replace(/\/$/, '')
  const host = process.env.SEARCH_API_HOST?.trim() || '127.0.0.1'
  const port = process.env.SEARCH_API_PORT?.trim() || '8080'
  return `http://${host}:${port}`
}

/**
 * 服务端调用 doc-processor 检索 HTTP 服务（POST /v1/search）。
 * 需配置 SEARCH_API_KEY 与 SEARCH_API_BASE_URL（或 SEARCH_API_HOST + SEARCH_API_PORT）。
 */
export async function postDocSearch(
  body: DocSearchRequestBody
): Promise<DocSearchResponse> {
  const key = process.env.SEARCH_API_KEY?.trim()
  if (!key) {
    throw new BusinessError(
      '检索服务未配置：请在环境变量中设置 SEARCH_API_KEY 与 SEARCH_API_BASE_URL（或 SEARCH_API_HOST / SEARCH_API_PORT）'
    )
  }

  const base = getSearchApiBaseUrl()
  const url = `${base}/v1/search`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new BusinessError(`无法连接检索服务（${base}）：${msg}`)
  }

  const text = await res.text()
  if (!res.ok) {
    let detail = text.slice(0, 500)
    try {
      const j = JSON.parse(text) as { detail?: string; message?: string }
      detail = j.detail ?? j.message ?? detail
    } catch {
      /* keep text */
    }
    throw new BusinessError(
      `检索失败（HTTP ${res.status}）${detail ? `：${detail}` : ''}`
    )
  }

  try {
    return JSON.parse(text) as DocSearchResponse
  } catch {
    throw new BusinessError('检索返回不是合法 JSON')
  }
}
