import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/core/auth'
import OaSyncPanel from '@/modules/oa-sync/components/oa-sync-panel'
import { listOaSyncRuns } from '@/modules/oa-sync/repo/sync-log.repo'

export default async function OaSyncPage() {
  const currentUser = await getCurrentUser()
  if (currentUser?.role !== 'admin') notFound()

  const recentRuns = await listOaSyncRuns(20)

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">OA 同步</h1>
        <p className="text-foreground/50 mt-1 text-sm">
          手动同步 OA 部门和用户数据
        </p>
      </div>

      <div className="border-divider bg-content1 rounded-lg border p-6">
        <OaSyncPanel recentRuns={recentRuns} />
      </div>
    </div>
  )
}
