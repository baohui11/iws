import type { CurrentUser } from '@/core/auth'
import { canAccessAdminNav, canAccessStatsNav } from '@/core/auth/nav-access'

export type NavVisibility = 'all' | 'authenticated' | 'stats' | 'admin'

export interface NavConfig {
  label: string
  href: string
  icon: string
  description?: string
  activeOn?: string[]
  children?: { label: string; href: string; adminOnly?: boolean }[]
  visibility: NavVisibility
}

export const navConfig: NavConfig[] = [
  {
    label: '主页',
    href: '/',
    icon: 'lucide:search',
    description: '文件搜索',
    visibility: 'all',
  },
  {
    label: '项目周报',
    href: '/weekly',
    icon: 'lucide:calendar-check',
    description: '填报与个人项目',
    activeOn: ['/weekly'],
    visibility: 'authenticated',
    children: [
      { label: '我的项目', href: '/weekly/projects' },
      { label: '我的周报', href: '/weekly/reports' },
      { label: '我的文件', href: '/weekly/files' },
      { label: '我的考勤', href: '/weekly/attendance' },
    ],
  },
  {
    label: '数据统计',
    href: '/stats',
    icon: 'lucide:chart-column',
    description: '报表与分析',
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
    href: '/admin/departments',
    icon: 'lucide:settings',
    description: '组织与配置',
    activeOn: ['/admin'],
    visibility: 'admin',
    children: [
      { label: '部门管理', href: '/admin/departments', adminOnly: true },
      { label: '数据权限', href: '/admin/data-scopes', adminOnly: true },
      { label: '用户管理', href: '/admin/users' },
      { label: '项目管理', href: '/admin/projects' },
      { label: 'OA 同步', href: '/admin/oa-sync' },
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
  return navConfig
    .filter((item) => isNavItemVisible(item, user))
    .map((item) => {
      if (item.visibility !== 'admin') return item
      const children =
        item.children?.filter((child) => !child.adminOnly || user?.role === 'admin') ??
        []
      return {
        ...item,
        href: user?.role === 'admin' ? '/admin/departments' : '/admin/users',
        children,
      }
    })
}
