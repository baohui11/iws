import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
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

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row md:items-stretch">
      <AdminSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
