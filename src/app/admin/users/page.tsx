import { listUsers } from '@/actions/admin/users.action'
import { getDepartmentTree } from '@/lib/db/admin/departments'
import UserTable from '@/components/admin/users/user-table'

export default async function UsersPage() {
  const [usersResult, departments] = await Promise.all([
    listUsers({ page: 1, pageSize: 20 }),
    getDepartmentTree(),
  ])

  const initialUsers = usersResult.success ? usersResult.data?.users ?? [] : []
  const initialTotal = usersResult.success ? usersResult.data?.total ?? 0 : 0

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">用户管理</h1>
        <p className="mt-1 text-sm text-foreground/50">
          管理系统用户，支持添加、编辑、删除和批量导入
        </p>
      </div>

      <div className="rounded-large border border-divider bg-content1 p-6 shadow-small">
        <UserTable
          initialUsers={initialUsers}
          initialTotal={initialTotal}
          departments={departments}
        />
      </div>
    </div>
  )
}
