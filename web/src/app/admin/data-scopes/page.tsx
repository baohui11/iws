import { notFound } from 'next/navigation'
import PageShell from '@/components/common/page-shell'
import { getCurrentUser } from '@/core/auth'
import { listAllUserDataScopes } from '@/modules/org/users/repo'
import DataScopesList from '@/modules/org/components/users/data-scopes-list'

export default async function AdminDataScopesPage() {
  const currentUser = await getCurrentUser()
  if (currentUser?.role !== 'admin') notFound()

  const scopes = await listAllUserDataScopes()

  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">数据权限</h1>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <DataScopesList scopes={scopes} />
      </div>
    </PageShell>
  )
}
