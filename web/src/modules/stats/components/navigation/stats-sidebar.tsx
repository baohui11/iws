'use client'

import { usePathname } from 'next/navigation'
import { Link, cn } from '@heroui/react'

const NAV: { label: string; href: string; match: (p: string) => boolean }[] = [
  {
    label: '周报统计',
    href: '/stats/weekly',
    match: (p) => p === '/stats/weekly',
  },
  {
    label: '文件统计',
    href: '/stats/files',
    match: (p) => p === '/stats/files',
  },
  {
    label: '考勤统计',
    href: '/stats/attendance',
    match: (p) => p === '/stats/attendance',
  },
  {
    label: '下载统计',
    href: '/stats/downloads',
    match: (p) => p === '/stats/downloads',
  },
]

export function StatsSidebar() {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-b border-divider bg-content1/80 backdrop-blur-sm',
        'md:min-h-0 md:w-56 md:self-stretch md:border-b-0 md:border-r'
      )}
    >
      <div className="px-3 py-4 md:sticky md:top-[60px] md:z-20 md:py-6">
        <p className="mb-3 hidden px-2 text-xs font-semibold uppercase tracking-wider text-foreground/40 md:block">
          数据统计
        </p>
        <nav className="flex flex-row gap-1 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
          {NAV.map((item) => {
            const active = item.match(pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'whitespace-nowrap rounded-medium px-3 py-2 text-md font-medium transition-colors md:w-full',
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
