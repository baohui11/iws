import { BusinessError } from '@/core/errors'

export interface OaPgrestClientOptions {
  baseUrl?: string
  token?: string
  pageSize?: number
}

interface ContentRange {
  from: number
  to: number
  total: number
}

const DEFAULT_PAGE_SIZE = 200

function getConfig(options: OaPgrestClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? process.env.OA_PGREST_BASE_URL)?.trim()
  const token = (options.token ?? process.env.OA_PGREST_TOKEN)?.trim()
  const pageSize =
    options.pageSize ??
    Number(process.env.OA_PGREST_PAGE_SIZE ?? DEFAULT_PAGE_SIZE)

  if (!baseUrl) throw new BusinessError('OA_PGREST_BASE_URL 未配置')
  if (!token) throw new BusinessError('OA_PGREST_TOKEN 未配置')
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new BusinessError('OA 分页大小必须是正整数')
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    token,
    pageSize,
  }
}

function parseContentRange(value: string | null): ContentRange {
  if (!value) throw new BusinessError('OA 接口响应缺少 Content-Range')

  const empty = value.match(/^\*\/(\d+)$/)
  if (empty) {
    return { from: 0, to: -1, total: Number(empty[1]) }
  }

  const matched = value.match(/^(\d+)-(\d+)\/(\d+)$/)
  if (!matched) {
    throw new BusinessError(`OA 接口 Content-Range 格式无效: ${value}`)
  }

  return {
    from: Number(matched[1]),
    to: Number(matched[2]),
    total: Number(matched[3]),
  }
}

function buildUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${baseUrl}/${path.replace(/^\/+/, '')}`
}

export async function fetchOaPgrestAll<T>(
  path: string,
  options: OaPgrestClientOptions = {}
): Promise<T[]> {
  const { baseUrl, token, pageSize } = getConfig(options)
  const rows: T[] = []
  let start = 0

  while (true) {
    const end = start + pageSize - 1
    const response = await fetch(buildUrl(baseUrl, path), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'count=exact',
        Range: `${start}-${end}`,
        'Range-Unit': 'items',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new BusinessError(
        `OA 接口请求失败: ${path} ${start}-${end} ${response.status} ${response.statusText}`
      )
    }

    const pageRows = (await response.json()) as T[]
    if (!Array.isArray(pageRows)) {
      throw new BusinessError('OA 接口响应不是数组')
    }

    rows.push(...pageRows)

    const range = parseContentRange(response.headers.get('content-range'))
    if (range.total === 0 || range.to >= range.total - 1) break
    start = range.to + 1
  }

  return rows
}
