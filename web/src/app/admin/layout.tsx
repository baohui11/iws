import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/core/auth'
import { canAccessAdminNav } from '@/core/auth/nav-access'

/** 登录由 proxy 校验；此处仅角色：admin / dept_admin */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!canAccessAdminNav(user.role)) redirect('/')

  return <>{children}</>
}
