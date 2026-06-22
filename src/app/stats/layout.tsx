import { redirect } from 'next/navigation'
import { StatsSidebar } from '@/components/stats/stats-sidebar'
import { canAccessStatsNav } from '@/lib/auth/nav-access'
import { getSessionProfile } from '@/lib/db/auth/profile'

/** 登录由 proxy 校验；此处仅角色：admin / dept_ld / dept_admin。部门范围在 action / db 中校验 */
export default async function StatsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getSessionProfile()

  if (!canAccessStatsNav(profile.role)) {
    redirect('/')
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row md:items-stretch">
      <StatsSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
