export type HomeFileActivityKind = 'upload' | 'recommend'

export interface HomeFileActivityRow {
  id: string
  kind: HomeFileActivityKind
  /** ISO 时间，用于排序与展示 */
  at: string
  actorName: string
  fileName: string
  fileId: string
  projectName: string | null
}

export interface HomeDashboardData {
  projectCount: number
  /** 当前 ISO 周、本人非草稿周报条数 */
  currentWeekReportCount: number
  /** 当前周所在自然月内，本人本周工作事项合计天数 */
  monthWorkDays: number
  fileUploadCount: number
  fileFavoriteCount: number
  fileRecommendCount: number
  fileActivity: HomeFileActivityRow[]
  pmPendingCount: number
  isPm: boolean
}
