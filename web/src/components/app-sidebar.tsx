'use client'

import { memo, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@heroui/react'
import type { CurrentUser } from '@/core/auth'
import {
  getNavConfigForUser,
  type NavConfig,
} from '@/components/navbar/nav-config'

function isNavActive(pathname: string, item: NavConfig): boolean {
  if (pathname === item.href) return true
  if (
    item.activeOn?.some(
      (path) => pathname === path || pathname.startsWith(path + '/')
    )
  ) {
    return true
  }
  return pathname.startsWith(item.href + '/')
}

function NavIcon({ name, className }: { name: string; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (name === 'lucide:search') {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    )
  }
  if (name === 'lucide:calendar-check') {
    return (
      <svg {...common}>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M3 10h18" />
        <path d="m8 15 2 2 5-5" />
      </svg>
    )
  }
  if (name === 'lucide:chart-column') {
    return (
      <svg {...common}>
        <path d="M4 20h16" />
        <path d="M7 16V9" />
        <path d="M12 16V4" />
        <path d="M17 16v-6" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 1 1-2.83 2.83l-.04-.04a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.06a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 1 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.06 14H3a2 2 0 1 1 0-4h.06A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 8.97 4.6 1.7 1.7 0 0 0 10 3.06V3a2 2 0 1 1 4 0v.06a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c.22.62.8 1 1.54 1H21a2 2 0 1 1 0 4h-.06A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  )
}

const SidebarChildLink = memo(function SidebarChildLink({
  label,
  href,
  active,
}: {
  label: string
  href: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center rounded-xl px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-default-100 text-foreground'
          : 'text-default-500 hover:bg-default-100/70 hover:text-foreground'
      )}
    >
      {label}
    </Link>
  )
})

const SidebarNavItem = memo(function SidebarNavItem({
  item,
  active,
  activeChildHref,
  collapsed,
}: {
  item: NavConfig
  active: boolean
  activeChildHref?: string
  collapsed: boolean
}) {
  const hasChildren = Boolean(item.children?.length)

  return (
    <div className="group/item relative shrink-0 md:shrink">
      <Link
        href={item.href}
        aria-label={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          'group flex whitespace-nowrap rounded-2xl px-3 py-2 text-md font-medium transition-colors md:w-full md:items-center md:gap-3 md:px-3.5 md:py-3',
          collapsed && 'md:justify-center md:px-0',
          active
            ? 'bg-default-100 text-foreground'
            : 'text-default-500 hover:bg-default-100/70 hover:text-foreground'
        )}
      >
        <span
          className={cn(
            'hidden size-6 shrink-0 items-center justify-center md:flex',
            active
              ? 'text-foreground'
              : 'text-default-500 group-hover:text-foreground'
          )}
        >
          <NavIcon name={item.icon} className="size-5" />
        </span>
        <span className={cn('min-w-0 truncate', collapsed && 'md:hidden')}>
          {item.label}
        </span>
      </Link>
      {collapsed && hasChildren ? (
        <div className="pointer-events-none absolute left-full top-0 z-[100] hidden pl-3 opacity-0 transition-opacity group-hover/item:pointer-events-auto group-hover/item:block group-hover/item:opacity-100 group-focus-within/item:pointer-events-auto group-focus-within/item:block group-focus-within/item:opacity-100 md:block">
          <div className="w-52 rounded-2xl border border-default-200 bg-content1 p-2 shadow-large ring-1 ring-black/5 dark:ring-white/10">
            <Link
              href={item.href}
              className={cn(
                'mb-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                active
                  ? 'bg-default-100 text-foreground'
                  : 'text-foreground hover:bg-default-100/70'
              )}
            >
              <NavIcon name={item.icon} className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
            <div className="space-y-1">
              {item.children?.map((child) => (
                <SidebarChildLink
                  key={child.href}
                  href={child.href}
                  label={child.label}
                  active={activeChildHref === child.href}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {!collapsed && active && item.children?.length ? (
        <div className="ml-8 mt-1 hidden space-y-1 md:block">
          {item.children.map((child) => (
            <SidebarChildLink
              key={child.href}
              href={child.href}
              label={child.label}
              active={activeChildHref === child.href}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
})

export default function AppSidebar({
  initialUser,
  collapsed,
}: {
  initialUser?: CurrentUser | null
  collapsed: boolean
}) {
  const pathname = usePathname()
  const navItems = useMemo(
    () => getNavConfigForUser(initialUser ?? null),
    [initialUser]
  )

  if (pathname.startsWith('/login')) return null

  return (
    <aside
      className={cn(
        'relative flex shrink-0 flex-col border-b border-default-200 bg-content1 backdrop-blur-md transition-[width] duration-200',
        'md:z-40 md:min-h-0 md:overflow-visible md:self-stretch md:border-b-0 md:border-r md:bg-content1',
        collapsed ? 'md:w-20' : 'md:w-56'
      )}
    >
      <div
        className={cn(
          'px-3 py-3 md:sticky md:top-[60px] md:z-[90] md:py-7',
          collapsed ? 'md:px-3' : 'md:px-4'
        )}
      >
        <nav className="flex flex-row gap-1 overflow-x-auto pb-1 md:flex-col md:gap-2 md:overflow-visible md:pb-0">
          {navItems.map((item) => {
            const active = isNavActive(pathname, item)
            const activeChildHref = item.children
              ?.filter(
                (child) =>
                  pathname === child.href ||
                  pathname.startsWith(child.href + '/')
              )
              .sort((a, b) => b.href.length - a.href.length)[0]?.href
            return (
              <SidebarNavItem
                key={item.href}
                item={item}
                active={active}
                activeChildHref={activeChildHref}
                collapsed={collapsed}
              />
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
