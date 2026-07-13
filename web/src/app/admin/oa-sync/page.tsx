import { notFound } from 'next/navigation'
import PageShell from '@/components/common/page-shell'
import { getCurrentUser } from '@/core/auth'
import { canAccessAdminNav } from '@/core/auth/nav-access'
import OaSyncPanel from '@/modules/oa-sync/components/oa-sync-panel'
import { listOaSyncRuns } from '@/modules/oa-sync/repo/sync-log.repo'

export default async function OaSyncPage() {
  const currentUser = await getCurrentUser()
  if (!canAccessAdminNav(currentUser?.role ?? null)) notFound()

  const recentRuns = await listOaSyncRuns(20)

  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">OA 同步</h1>
      </div>

      <div className="border-divider bg-content1 rounded-lg border p-6">
        <OaSyncPanel
          recentRuns={recentRuns}
          canRunSync={currentUser?.role === 'admin'}
        />
      </div>
    </PageShell>
  )
}
