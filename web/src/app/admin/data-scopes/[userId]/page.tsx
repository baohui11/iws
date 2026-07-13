import { notFound } from 'next/navigation'
import PageShell from '@/components/common/page-shell'
import { getCurrentUser } from '@/core/auth'
import { getDepartmentTree } from '@/modules/org/departments/repo'
import DataScopeForm from '@/modules/org/components/users/data-scope-form'
import {
  getUserById,
  listUserDataScopes,
} from '@/modules/org/users/repo'

interface PageProps {
  params: Promise<{ userId: string }>
}

export default async function EditDataScopePage({ params }: PageProps) {
  const currentUser = await getCurrentUser()
  if (currentUser?.role !== 'admin') notFound()

  const { userId } = await params
  const [user, scopes, departments] = await Promise.all([
    getUserById(userId),
    listUserDataScopes(userId),
    getDepartmentTree(),
  ])

  if (!user) notFound()

  return (
    <PageShell width="md">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">编辑数据授权</h1>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <DataScopeForm
          mode="edit"
          users={[user]}
          departments={departments}
          initialUserId={user.id}
          initialScopes={scopes}
        />
      </div>
    </PageShell>
  )
}
