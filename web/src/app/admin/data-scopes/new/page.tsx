import { notFound } from 'next/navigation'
import PageShell from '@/components/common/page-shell'
import { getCurrentUser } from '@/core/auth'
import { getDepartmentTree } from '@/modules/org/departments/repo'
import DataScopeForm from '@/modules/org/components/users/data-scope-form'
import { searchUsersForDataScopePick } from '@/modules/org/users/repo'

export default async function NewDataScopePage() {
  const currentUser = await getCurrentUser()
  if (currentUser?.role !== 'admin') notFound()

  const [usersResult, departments] = await Promise.all([
    searchUsersForDataScopePick({ limit: 50 }),
    getDepartmentTree(),
  ])

  return (
    <PageShell width="md">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">新增数据授权</h1>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <DataScopeForm
          mode="create"
          users={usersResult}
          departments={departments}
        />
      </div>
    </PageShell>
  )
}
