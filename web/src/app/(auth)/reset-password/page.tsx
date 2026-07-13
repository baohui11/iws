import Link from 'next/link'
import ResetPasswordForm from '@/modules/auth/components/reset-password-form'
import { verifyPasswordResetToken } from '@/modules/auth/service'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const token = typeof sp.token === 'string' ? sp.token : ''
  const rawType = typeof sp.type === 'string' ? sp.type : 'password_reset'
  const type = rawType === 'invite' ? 'invite' : 'password_reset'

  const verification = token
    ? await verifyPasswordResetToken({ token, type })
    : { valid: false, type: null }

  if (!verification.valid) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center p-6">
        <div className="rounded-large bg-background/60 shadow-small dark:bg-default-100/50 flex w-full max-w-sm flex-col gap-4 px-8 py-8 text-center">
          <p className="text-lg font-medium">链接无效或已过期</p>
          <p className="text-default-500 text-sm">
            请重新申请密码重置邮件，或联系管理员重新发送邀请。
          </p>
          <Link
            href="/login"
            className="rounded-medium bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
          >
            返回登录
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6">
      <ResetPasswordForm token={token} type={verification.type ?? type} />
    </div>
  )
}
