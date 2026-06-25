'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { logoutAction } from '../actions'

export function LogoutButton() {
  const router = useRouter()
  return (
    <Button
      variant="flat"
      size="sm"
      onPress={async () => {
        await logoutAction()
        router.replace('/login')
        router.refresh()
      }}
    >
      退出登录
    </Button>
  )
}
