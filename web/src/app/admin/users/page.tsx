import { getUserList } from '@/modules/org/users/repo'
import { getDepartmentTree } from '@/modules/org/departments/repo'
import UserTable from '@/modules/org/components/users/user-table'

export default async function UsersPage() {
  const [usersResult, departments] = await Promise.all([
    getUserList({ page: 1, pageSize: 20 }),
    getDepartmentTree(),
  ])

  const initialUsers = usersResult.users
  const initialTotal = usersResult.total

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">用户管理</h1>
        <p className="text-foreground/50 mt-1 text-sm">
          管理系统用户，支持添加、编辑、删除和批量导入
        </p>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <UserTable
          initialUsers={initialUsers}
          initialTotal={initialTotal}
          departments={departments}
        />
      </div>
    </div>
  )
}
