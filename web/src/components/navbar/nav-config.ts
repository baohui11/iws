import type { CurrentUser } from '@/core/auth'
import { canAccessAdminNav, canAccessStatsNav } from '@/core/auth/nav-access'

export type NavVisibility = 'all' | 'authenticated' | 'stats' | 'admin'

export interface NavConfig {
  label: string
  href: string
  activeOn?: string[]
  children?: { label: string; href: string }[]
  visibility: NavVisibility
}

export const navConfig: NavConfig[] = [
  {
    label: '主页',
    href: '/',
    visibility: 'all',
  },
  {
    label: '项目周报',
    href: '/weekly/reports',
    activeOn: ['/weekly'],
    visibility: 'authenticated',
    children: [
      { label: '我的周报', href: '/weekly/reports' },
      { label: '我的项目', href: '/weekly/projects' },
      { label: '项目文件', href: '/weekly/files' },
    ],
  },
  {
    label: '搜索文件',
    href: '/files',
    visibility: 'authenticated',
  },
  {
    label: '数据统计',
    href: '/stats',
    activeOn: ['/stats'],
    visibility: 'stats',
    children: [
      { label: '周报统计', href: '/stats/weekly' },
      { label: '文件统计', href: '/stats/files' },
      { label: '考勤数据', href: '/stats/attendance' },
      { label: '下载统计', href: '/stats/downloads' },
    ],
  },
  {
    label: '系统管理',
    href: '/admin/users',
    activeOn: ['/admin'],
    visibility: 'admin',
    children: [
      { label: '用户管理', href: '/admin/users' },
      { label: '部门管理', href: '/admin/departments' },
      { label: '项目管理', href: '/admin/projects' },
    ],
  },
]

export function isNavItemVisible(
  item: NavConfig,
  user: CurrentUser | null | undefined
): boolean {
  switch (item.visibility) {
    case 'all':
      return true
    case 'authenticated':
      return user != null
    case 'stats':
      return canAccessStatsNav(user?.role ?? null)
    case 'admin':
      return canAccessAdminNav(user?.role ?? null)
    default:
      return false
  }
}

export function getNavConfigForUser(
  user: CurrentUser | null | undefined
): NavConfig[] {
  return navConfig.filter((item) => isNavItemVisible(item, user))
}
