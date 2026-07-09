/** 我的项目列表：与地址栏 ?q=&dept=&mine= 同步（列表位置用滚动分页，不写 URL） */

export type WeeklyProjectsUrlState = {
  q: string
  dept: string
  stage: string
  /** 项目状态 enum，空字符串表示全部 */
  status: string
  mine: boolean
}

function firstString(v: string | string[] | undefined): string {
  if (v == null) return ''
  return typeof v === 'string' ? v : (v[0] ?? '')
}

/** 服务端：从 page 的 searchParams 解析 */
export function parseWeeklyProjectsSearchParamsFromRecord(
  sp: Record<string, string | string[] | undefined>
): WeeklyProjectsUrlState {
  const q = firstString(sp.q)
  const dept = firstString(sp.dept)
  const stage = firstString(sp.stage)
  const mine = firstString(sp.mine) !== '0'
  const status = firstString(sp.status)
  return { q, dept, stage, status, mine }
}

/** 客户端：从 URLSearchParams 解析 */
export function parseWeeklyProjectsSearchParams(
  sp: URLSearchParams
): WeeklyProjectsUrlState {
  return parseWeeklyProjectsSearchParamsFromRecord(
    Object.fromEntries(sp.entries())
  )
}

/** 构建查询串（省略默认值：无筛选、我参与） */
export function buildWeeklyProjectsSearchParams(
  state: WeeklyProjectsUrlState
): URLSearchParams {
  const p = new URLSearchParams()
  if (state.q.trim()) p.set('q', state.q.trim())
  if (state.dept.trim()) p.set('dept', state.dept.trim())
  if (state.stage.trim()) p.set('stage', state.stage.trim())
  if (state.status.trim()) p.set('status', state.status.trim())
  if (!state.mine) p.set('mine', '0')
  return p
}

/** 进入详情时携带「返回列表」完整路径，仅允许 /weekly/projects 前缀 */
export function buildWeeklyProjectDetailHref(
  projectId: string,
  listPathname: string,
  listSearchParams: URLSearchParams
): string {
  const base = `/weekly/projects/${projectId}`
  const qs = listSearchParams.toString()
  const listUrl = qs ? `${listPathname}?${qs}` : listPathname
  if (!listUrl.startsWith('/weekly/projects')) {
    return base
  }
  return `${base}?from=${encodeURIComponent(listUrl)}`
}

/** 详情页 ?from= 校验 */
export function parseSafeWeeklyProjectsFromParam(
  raw: string | null | undefined
): string | null {
  if (!raw?.trim()) return null
  try {
    const decoded = decodeURIComponent(raw.trim())
    if (decoded.startsWith('/weekly/projects')) return decoded
  } catch {
    /* ignore */
  }
  return null
}
