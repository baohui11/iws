'use client'

import { memo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@heroui/react'
import { ThemeSwitch } from '@/components/navbar/theme-switch'
import UserMenu from '@/components/navbar/user-menu'
import type { CurrentUser } from '@/core/auth'

interface LayoutNavbarProps {
  initialUser?: CurrentUser | null
  showUserMenu?: boolean
  className?: string
}

function LayoutNavbar({
  initialUser,
  showUserMenu = true,
  className,
}: LayoutNavbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex h-[60px] shrink-0 items-center border-b border-default-100 bg-content1/95 px-4 backdrop-blur-md md:px-6',
        className
      )}
    >
      <Link href="/" className="flex min-w-0 items-center">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-default-100">
          <Image
            src="/brand.png"
            alt="brand"
            width={28}
            height={28}
            className="rounded-full"
          />
        </div>
        <div className="ml-3 min-w-0">
          <p className="truncate text-base font-semibold tracking-tight text-foreground">
            周报文件系统
          </p>
        </div>
      </Link>

      <div className="ml-auto flex items-center gap-3">
        {showUserMenu ? <UserMenu initialUser={initialUser ?? null} /> : null}
        <ThemeSwitch />
      </div>
    </header>
  )
}

export default memo(LayoutNavbar)
