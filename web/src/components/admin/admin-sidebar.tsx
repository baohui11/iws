'use client'

import { usePathname } from 'next/navigation'
import { Link, cn } from '@heroui/react'
import type { SystemRole } from '@/core/auth/current-user'

export const adminNavItems = [
  {
    label: '部门管理',
    href: '/admin/departments',
    match: (p: string) => p.startsWith('/admin/departments'),
    adminOnly: true,
  },
  {
    label: '数据权限',
    href: '/admin/data-scopes',
    match: (p: string) => p.startsWith('/admin/data-scopes'),
    adminOnly: true,
  },
  {
    label: '用户管理',
    href: '/admin/users',
    match: (p: string) => p.startsWith('/admin/users'),
  },
  {
    label: '项目管理',
    href: '/admin/projects',
    match: (p: string) => p.startsWith('/admin/projects'),
  },
  {
    label: 'OA 同步',
    href: '/admin/oa-sync',
    match: (p: string) => p.startsWith('/admin/oa-sync'),
    adminOnly: true,
  },
] as const

export function AdminSidebar({ role }: { role: SystemRole | null }) {
  const pathname = usePathname()
  const items = adminNavItems.filter(
    (item) => !('adminOnly' in item) || role === 'admin'
  )

  return (
    <aside
      className={cn(
        'border-divider bg-content1/80 flex shrink-0 flex-col border-b backdrop-blur-sm',
        'md:min-h-0 md:w-56 md:self-stretch md:border-b-0 md:border-r'
      )}
    >
      <div className="px-3 py-4 md:sticky md:top-[60px] md:z-20 md:py-6">
        <p className="text-foreground/40 mb-3 hidden px-2 text-xs font-semibold tracking-wider uppercase md:block">
          系统管理
        </p>
        <nav className="flex flex-row gap-1 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
          {items.map((item) => {
            const active = item.match(pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-medium text-md px-3 py-2 font-medium whitespace-nowrap transition-colors md:w-full',
                  active
                    ? 'bg-primary/15 text-primary'
                    : 'text-default-600 hover:bg-default-100 hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
