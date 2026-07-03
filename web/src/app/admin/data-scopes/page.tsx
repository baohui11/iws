import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/core/auth'
import { listAllUserDataScopes } from '@/modules/org/users/repo'
import DataScopesList from '@/modules/org/components/users/data-scopes-list'

export default async function AdminDataScopesPage() {
  const currentUser = await getCurrentUser()
  if (currentUser?.role !== 'admin') notFound()

  const scopes = await listAllUserDataScopes()

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">数据权限</h1>
        <p className="text-foreground/50 mt-1 text-sm">
          维护用户额外数据范围。用户所属部门默认生效，这里只配置额外部门或全公司权限。
        </p>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <DataScopesList scopes={scopes} />
      </div>
    </div>
  )
}
