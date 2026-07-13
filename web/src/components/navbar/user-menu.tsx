'use client'

import { memo } from 'react'
import {
  Avatar,
  Badge,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from '@heroui/react'
import { useRouter } from 'next/navigation'
import type { CurrentUser } from '@/core/auth'
import { resolveAvatarUrl } from '@/core/storage/buckets'
import { logoutAction } from '@/modules/auth/actions'

interface UserMenuProps {
  initialUser: CurrentUser | null
}

function UserMenu({ initialUser }: UserMenuProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    await logoutAction()
    router.refresh()
    router.push('/login')
  }

  if (!initialUser) {
    return (
      <Button
        size="sm"
        variant="flat"
        color="secondary"
        radius="full"
        onPress={() => router.push('/login')}
      >
        未登录
      </Button>
    )
  }

  const avatarName =
    initialUser.name?.trim().charAt(0)?.toUpperCase() ??
    initialUser.email?.trim().charAt(0)?.toUpperCase() ??
    'U'

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button
          isIconOnly
          radius="full"
          variant="light"
          size="sm"
          className="overflow-visible"
          aria-label="用户菜单"
        >
          <Badge color="success" content="" placement="bottom-right" shape="circle">
            <Avatar
              size="sm"
              src={resolveAvatarUrl(initialUser.avatarUrl)}
              name={avatarName}
              classNames={{
                base: 'bg-default-100',
                name: 'font-semibold text-base',
              }}
            />
          </Badge>
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Profile Actions" variant="flat" className="mt-2 mb-2">
        <DropdownItem key="info" className="gap-4" isReadOnly>
          <p className="text-base font-semibold">{initialUser.name}</p>
          <p className="text-default-400 text-xs">{initialUser.position}</p>
          <p className="text-default-400 text-xs">{initialUser.email}</p>
        </DropdownItem>
        <DropdownItem key="settings" onPress={() => router.push('/profile')}>
          个人设置
        </DropdownItem>
        <DropdownItem key="logout" color="danger" onPress={handleSignOut}>
          登出
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}

export default memo(UserMenu)
