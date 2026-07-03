import { notFound } from 'next/navigation'
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
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">新增数据授权</h1>
        <p className="text-foreground/50 mt-1 text-sm">
          一次维护一个用户的全部额外数据范围，保存后会覆盖该用户原有额外授权。
        </p>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <DataScopeForm
          mode="create"
          users={usersResult}
          departments={departments}
        />
      </div>
    </div>
  )
}
