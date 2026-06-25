import { Suspense } from 'react'
import { LoginForm } from '@/modules/auth/components/login-form'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
