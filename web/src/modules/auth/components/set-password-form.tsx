'use client'

import type { InputProps } from '@heroui/react'
import React from 'react'
import { Button, Input, Form, addToast } from '@heroui/react'
import { Icon, addCollection } from '@iconify/react'
import solarIcons from '@iconify-json/solar/icons.json'
import { useRouter } from 'next/navigation'
import { setPasswordAction } from '../actions'

addCollection(solarIcons as Parameters<typeof addCollection>[0])

export interface SetPasswordFormProps {
  variant?: 'page' | 'embedded'
  onSuccess?: () => void
}

export default function SetPasswordForm({
  variant = 'page',
  onSuccess,
}: SetPasswordFormProps) {
  const router = useRouter()
  const isEmbedded = variant === 'embedded'
  const [isVisible, setIsVisible] = React.useState(false)
  const [isConfirmVisible, setIsConfirmVisible] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [isSuccess, setIsSuccess] = React.useState(false)

  const inputClasses: InputProps['classNames'] = {
    inputWrapper:
      'border-default-200/60 dark:border-default-600/40 bg-white dark:bg-default-100 group-data-[focus=true]:border-primary data-[hover=true]:border-default-300',
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSuccess(false)
    setIsLoading(true)
    const formEl = event.currentTarget

    try {
      const formData = new FormData(formEl)
      const password = formData.get('password') as string
      const confirmPassword = formData.get('confirmPassword') as string

      const result = await setPasswordAction({ password, confirmPassword })

      if (result.success) {
        if (isEmbedded) {
          addToast({
            title: '密码已更新',
            description: '请使用新密码登录',
            color: 'success',
            timeout: 2500,
          })
          router.refresh()
          onSuccess?.()
          formEl.reset()
        } else {
          setIsSuccess(true)
          setError('密码设置成功，正在跳转...')
          setTimeout(() => router.push('/'), 1500)
        }
      } else {
        setError(result.message || '密码设置失败，请重试')
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  const pageWrapper =
    'rounded-large bg-background/60 shadow-small dark:bg-default-100/50 -mt-12 flex w-full max-w-sm flex-col gap-4 px-8 pt-6 pb-10 backdrop-blur-md backdrop-saturate-150'

  return (
    <div className={isEmbedded ? 'w-full max-w-md' : pageWrapper}>
      {!isEmbedded ? (
        <p className="pb-2 text-xl font-medium">设置密码</p>
      ) : (
        <p className="text-default-600 text-small mb-1">
          新密码至少 8 位，请两次输入一致。
        </p>
      )}

      <Form className="flex flex-col gap-3" validationBehavior="native" onSubmit={handleSubmit}>
        {error && (
          <div
            className={`rounded-medium border px-3 py-2 text-sm ${
              isSuccess && !isEmbedded
                ? 'border-success/20 bg-success-50 text-success-700'
                : 'border-danger/20 bg-danger-50 text-danger'
            }`}
          >
            <Icon
              className="mr-1 inline"
              icon={
                isSuccess && !isEmbedded
                  ? 'solar:check-circle-bold'
                  : 'solar:danger-circle-bold'
              }
            />
            {error}
          </div>
        )}

        <Input
          isRequired
          autoComplete="new-password"
          classNames={inputClasses}
          isDisabled={isLoading}
          name="password"
          placeholder="请输入新密码（至少 8 位）"
          errorMessage="请输入密码"
          startContent={
            <Icon className="text-foreground/50 text-xl" icon="solar:lock-password-linear" />
          }
          endContent={
            <button
              aria-label="切换密码可见性"
              className="focus:outline-none"
              disabled={isLoading}
              type="button"
              onClick={() => setIsVisible(!isVisible)}
            >
              <Icon
                className="text-foreground/50 text-2xl"
                icon={isVisible ? 'solar:eye-closed-linear' : 'solar:eye-bold'}
              />
            </button>
          }
          type={isVisible ? 'text' : 'password'}
          variant="bordered"
        />

        <Input
          isRequired
          autoComplete="new-password"
          classNames={inputClasses}
          isDisabled={isLoading}
          name="confirmPassword"
          placeholder="请再次输入新密码"
          errorMessage="请确认密码"
          startContent={
            <Icon className="text-foreground/50 text-xl" icon="solar:lock-password-bold" />
          }
          endContent={
            <button
              aria-label="切换确认密码可见性"
              className="focus:outline-none"
              disabled={isLoading}
              type="button"
              onClick={() => setIsConfirmVisible(!isConfirmVisible)}
            >
              <Icon
                className="text-foreground/50 text-2xl"
                icon={isConfirmVisible ? 'solar:eye-closed-linear' : 'solar:eye-bold'}
              />
            </button>
          }
          type={isConfirmVisible ? 'text' : 'password'}
          variant="bordered"
        />

        <Button
          className="bg-foreground/10 dark:bg-foreground/20 mt-1 w-full"
          isLoading={isLoading}
          type="submit"
        >
          {isLoading ? '设置中...' : '确认设置'}
        </Button>
      </Form>
    </div>
  )
}
