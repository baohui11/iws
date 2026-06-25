/** 我的项目列表：与地址栏 ?view=&q=&dept=&mine= 同步（列表位置用滚动分页，不写 URL） */

export type WeeklyProjectsUrlState = {
  view: 'cards' | 'table'
  q: string
  dept: string
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
  const mine = firstString(sp.mine) === '1'
  const status = firstString(sp.status)
  const viewRaw = firstString(sp.view)
  const view: WeeklyProjectsUrlState['view'] =
    viewRaw === 'table' ? 'table' : 'cards'
  return { view, q, dept, status, mine }
}

/** 客户端：从 URLSearchParams 解析 */
export function parseWeeklyProjectsSearchParams(
  sp: URLSearchParams
): WeeklyProjectsUrlState {
  return parseWeeklyProjectsSearchParamsFromRecord(
    Object.fromEntries(sp.entries())
  )
}

/** 构建查询串（省略默认值：卡片、无筛选） */
export function buildWeeklyProjectsSearchParams(
  state: WeeklyProjectsUrlState
): URLSearchParams {
  const p = new URLSearchParams()
  if (state.view === 'table') p.set('view', 'table')
  if (state.q.trim()) p.set('q', state.q.trim())
  if (state.dept.trim()) p.set('dept', state.dept.trim())
  if (state.status.trim()) p.set('status', state.status.trim())
  if (state.mine) p.set('mine', '1')
  return p
}

/** 进入详情时携带「返回列表」完整路径，仅允许 /weekly/projects 前缀 */
export function buildWeeklyProjectDetailHref(
  projectId: string,
  listPathname: string,
  listSearchParams: URLSearchParams
): string {
  const base = `/weekly/projects/${projectId}/reports`
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
