import { redirect } from 'next/navigation'
import { canAccessStatsNav } from '@/core/auth/nav-access'
import { getCurrentUser } from '@/core/auth/current-user'
import { StatsSidebar } from '@/modules/stats/components/navigation/stats-sidebar'

/** 登录由 proxy 校验；此处仅角色：admin / dept_ld / dept_admin。部门范围在 service 中校验 */
export default async function StatsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!canAccessStatsNav(user?.role)) {
    redirect('/')
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row md:items-stretch">
      <StatsSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
