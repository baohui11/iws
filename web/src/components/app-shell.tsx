'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@heroui/react'
import AppSidebar from '@/components/app-sidebar'
import LayoutNavbar from '@/components/navbar'
import type { CurrentUser } from '@/core/auth'

const SIDEBAR_COLLAPSED_KEY = 'iws-sidebar-collapsed'
const USER_UPDATED_EVENT = 'iws:user-updated'

type UserUpdatedDetail = Partial<
  Pick<CurrentUser, 'avatarUrl' | 'name' | 'email' | 'position' | 'role'>
>

function SidebarCollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      aria-hidden
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {collapsed ? (
        <>
          <path d="m9 18 6-6-6-6" />
          <path d="M4 4v16" />
        </>
      ) : (
        <>
          <path d="m15 18-6-6 6-6" />
          <path d="M20 4v16" />
        </>
      )}
    </svg>
  )
}

export default function AppShell({
  initialUser,
  initialSidebarCollapsed,
  children,
}: {
  initialUser: CurrentUser | null
  initialSidebarCollapsed: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [stableUser, setStableUser] = useState(() => initialUser)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => initialSidebarCollapsed
  )

  useEffect(() => {
    const currentId = stableUser?.id ?? null
    const nextId = initialUser?.id ?? null
    if (currentId === nextId) {
      if (!initialUser || !stableUser) return
      if (
        initialUser.avatarUrl === stableUser.avatarUrl &&
        initialUser.name === stableUser.name &&
        initialUser.email === stableUser.email &&
        initialUser.position === stableUser.position &&
        initialUser.role === stableUser.role
      ) {
        return
      }
      setStableUser((current) =>
        current?.id === initialUser.id ? { ...current, ...initialUser } : initialUser
      )
      return
    }
    const timer = window.setTimeout(() => {
      setStableUser(initialUser)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [initialUser, stableUser?.id])

  useEffect(() => {
    const handleUserUpdated = (event: Event) => {
      const detail = (event as CustomEvent<UserUpdatedDetail>).detail
      if (!detail) return
      setStableUser((current) => (current ? { ...current, ...detail } : current))
    }

    window.addEventListener(USER_UPDATED_EVENT, handleUserUpdated)
    return () => window.removeEventListener(USER_UPDATED_EVENT, handleUserUpdated)
  }, [])

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      document.cookie = `${SIDEBAR_COLLAPSED_KEY}=${next ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`
      return next
    })
  }

  if (pathname === '/login' || pathname === '/reset-password') {
    return (
      <div className="flex min-h-screen flex-col">
        <LayoutNavbar showUserMenu={false} />
        <main className="flex min-h-0 flex-1 flex-col bg-default-50/40 dark:bg-background">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <LayoutNavbar initialUser={stableUser} />
      <button
        type="button"
        onClick={toggleSidebarCollapsed}
        className={cn(
          'fixed top-[78px] z-[120] hidden size-8 -translate-x-1/2 items-center justify-center rounded-full border border-default-200 bg-content1 text-default-500 shadow-small transition-[background-color,color,left] hover:bg-default-100 hover:text-foreground md:inline-flex',
          sidebarCollapsed ? 'left-20' : 'left-56'
        )}
        aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
        title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        <SidebarCollapseIcon collapsed={sidebarCollapsed} />
      </button>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <AppSidebar
          initialUser={stableUser}
          collapsed={sidebarCollapsed}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
