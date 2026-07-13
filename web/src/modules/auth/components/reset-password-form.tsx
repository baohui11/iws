'use client'

import type { InputProps } from '@heroui/react'
import { Button, Form, Input } from '@heroui/react'
import { Icon, addCollection } from '@iconify/react'
import solarIcons from '@iconify-json/solar/icons.json'
import { useRouter } from 'next/navigation'
import React from 'react'
import { resetPasswordWithTokenAction } from '../actions'

addCollection(solarIcons as Parameters<typeof addCollection>[0])

export default function ResetPasswordForm({
  token,
  type,
}: {
  token: string
  type: 'invite' | 'password_reset'
}) {
  const router = useRouter()
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
    const form = event.currentTarget

    try {
      const formData = new FormData(form)
      const result = await resetPasswordWithTokenAction({
        token,
        password: String(formData.get('password') ?? ''),
        confirmPassword: String(formData.get('confirmPassword') ?? ''),
      })
      if (!result.success) {
        setError(result.message || '设置密码失败')
        return
      }
      setIsSuccess(true)
      setError('密码已设置，正在进入系统...')
      form.reset()
      window.setTimeout(() => {
        router.replace('/')
        router.refresh()
      }, 900)
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="rounded-large bg-background/60 shadow-small dark:bg-default-100/50 -mt-12 flex w-full max-w-sm flex-col gap-4 px-8 pt-6 pb-10 backdrop-blur-md backdrop-saturate-150">
      <p className="pb-2 text-xl font-medium">
        {type === 'invite' ? '设置登录密码' : '重置登录密码'}
      </p>
      <p className="text-default-500 -mt-2 text-sm">
        新密码至少 8 位，提交成功后将自动登录。
      </p>

      <Form
        className="flex flex-col gap-3"
        validationBehavior="native"
        onSubmit={handleSubmit}
      >
        {error ? (
          <div
            className={`rounded-medium border px-3 py-2 text-sm ${
              isSuccess
                ? 'border-success/20 bg-success-50 text-success-700'
                : 'border-danger/20 bg-danger-50 text-danger'
            }`}
          >
            <Icon
              className="mr-1 inline"
              icon={isSuccess ? 'solar:check-circle-bold' : 'solar:danger-circle-bold'}
            />
            {error}
          </div>
        ) : null}

        <Input
          isRequired
          autoComplete="new-password"
          classNames={inputClasses}
          isDisabled={isLoading || isSuccess}
          name="password"
          placeholder="请输入新密码（至少 8 位）"
          startContent={
            <Icon className="text-foreground/50 text-xl" icon="solar:lock-password-linear" />
          }
          endContent={
            <button
              aria-label="切换密码可见性"
              className="focus:outline-none"
              disabled={isLoading}
              type="button"
              onClick={() => setIsVisible((v) => !v)}
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
          isDisabled={isLoading || isSuccess}
          name="confirmPassword"
          placeholder="请再次输入新密码"
          startContent={
            <Icon className="text-foreground/50 text-xl" icon="solar:lock-password-bold" />
          }
          endContent={
            <button
              aria-label="切换确认密码可见性"
              className="focus:outline-none"
              disabled={isLoading}
              type="button"
              onClick={() => setIsConfirmVisible((v) => !v)}
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
          isDisabled={isSuccess}
          type="submit"
        >
          {isLoading ? '提交中...' : '确认设置'}
        </Button>
      </Form>
    </div>
  )
}
