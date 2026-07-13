'use client'

import type { InputProps } from '@heroui/react'
import { Button, Form, Input, addToast } from '@heroui/react'
import { Icon, addCollection } from '@iconify/react'
import solarIcons from '@iconify-json/solar/icons.json'
import React from 'react'
import { changePasswordAction } from '@/modules/auth/actions'

addCollection(solarIcons as Parameters<typeof addCollection>[0])

interface ChangePasswordFormProps {
  onSuccess?: () => void
}

export default function ChangePasswordForm({
  onSuccess,
}: ChangePasswordFormProps) {
  const [visible, setVisible] = React.useState({
    current: false,
    next: false,
    confirm: false,
  })
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const inputClasses: InputProps['classNames'] = {
    inputWrapper:
      'border-default-200/60 dark:border-default-600/40 bg-white dark:bg-default-100 group-data-[focus=true]:border-primary data-[hover=true]:border-default-300',
  }

  const toggle = (key: keyof typeof visible) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const passwordToggle = (
    key: keyof typeof visible,
    label: string
  ): React.ReactNode => (
    <button
      aria-label={label}
      className="focus:outline-none"
      disabled={isLoading}
      type="button"
      onClick={() => toggle(key)}
    >
      <Icon
        className="text-foreground/50 text-2xl"
        icon={visible[key] ? 'solar:eye-closed-linear' : 'solar:eye-bold'}
      />
    </button>
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)
    const formEl = event.currentTarget

    try {
      const formData = new FormData(formEl)
      const result = await changePasswordAction({
        currentPassword: String(formData.get('currentPassword') ?? ''),
        newPassword: String(formData.get('newPassword') ?? ''),
        confirmPassword: String(formData.get('confirmPassword') ?? ''),
      })

      if (result.success) {
        addToast({
          title: '密码已更新',
          description: '下次登录请使用新密码',
          color: 'success',
          timeout: 2500,
        })
        formEl.reset()
        onSuccess?.()
      } else {
        setError(result.message || '密码修改失败，请重试')
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <p className="text-default-600 mb-3 text-small">
        请输入当前密码，并设置不少于 8 位的新密码。
      </p>

      <Form
        className="flex flex-col gap-3"
        validationBehavior="native"
        onSubmit={handleSubmit}
      >
        {error ? (
          <div className="border-danger/20 bg-danger-50 text-danger rounded-medium border px-3 py-2 text-sm">
            <Icon className="mr-1 inline" icon="solar:danger-circle-bold" />
            {error}
          </div>
        ) : null}

        <Input
          isRequired
          autoComplete="current-password"
          classNames={inputClasses}
          isDisabled={isLoading}
          name="currentPassword"
          placeholder="请输入当前密码"
          startContent={
            <Icon
              className="text-foreground/50 text-xl"
              icon="solar:lock-password-linear"
            />
          }
          endContent={passwordToggle('current', '切换当前密码可见性')}
          type={visible.current ? 'text' : 'password'}
          variant="bordered"
        />

        <Input
          isRequired
          autoComplete="new-password"
          classNames={inputClasses}
          isDisabled={isLoading}
          name="newPassword"
          placeholder="请输入新密码（至少 8 位）"
          startContent={
            <Icon
              className="text-foreground/50 text-xl"
              icon="solar:lock-password-bold"
            />
          }
          endContent={passwordToggle('next', '切换新密码可见性')}
          type={visible.next ? 'text' : 'password'}
          variant="bordered"
        />

        <Input
          isRequired
          autoComplete="new-password"
          classNames={inputClasses}
          isDisabled={isLoading}
          name="confirmPassword"
          placeholder="请再次输入新密码"
          startContent={
            <Icon
              className="text-foreground/50 text-xl"
              icon="solar:lock-password-bold"
            />
          }
          endContent={passwordToggle('confirm', '切换确认密码可见性')}
          type={visible.confirm ? 'text' : 'password'}
          variant="bordered"
        />

        <Button
          className="bg-foreground/10 dark:bg-foreground/20 mt-1 w-full"
          isLoading={isLoading}
          type="submit"
        >
          {isLoading ? '修改中...' : '确认修改'}
        </Button>
      </Form>
    </div>
  )
}
