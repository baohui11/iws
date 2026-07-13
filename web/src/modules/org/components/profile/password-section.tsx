'use client'

import { Button } from '@heroui/react'
import React from 'react'
import ChangePasswordForm from './change-password-form'

export default function ProfilePasswordSection() {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div className="flex flex-col gap-4">
      {!expanded ? (
        <Button
          className="w-fit"
          color="primary"
          variant="flat"
          onPress={() => setExpanded(true)}
        >
          修改登录密码
        </Button>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button size="sm" variant="flat" onPress={() => setExpanded(false)}>
              收起
            </Button>
          </div>
          <ChangePasswordForm onSuccess={() => setExpanded(false)} />
        </div>
      )}
    </div>
  )
}
