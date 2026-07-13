import PageShell from '@/components/common/page-shell'
import {
  getAdminDepartmentScopeIds,
  getDepartmentTree,
} from '@/modules/org/departments/repo'
import { getUserList } from '@/modules/org/users/repo'
import { requireAdmin } from '@/modules/org/guard'
import UserTable from '@/modules/org/components/users/user-table'

export default async function UsersPage() {
  const actor = await requireAdmin()
  const allowedDepartmentIds = await getAdminDepartmentScopeIds(actor, {
    includeInactive: true,
  })
  const [usersResult, departments] = await Promise.all([
    getUserList({
      page: 1,
      pageSize: 20,
      allowed_department_ids: allowedDepartmentIds,
    }),
    getDepartmentTree({
      includeInactive: true,
      allowedDepartmentIds,
    }),
  ])

  const initialUsers = usersResult.users
  const initialTotal = usersResult.total

  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">用户管理</h1>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <UserTable
          initialUsers={initialUsers}
          initialTotal={initialTotal}
          departments={departments}
        />
      </div>
    </PageShell>
  )
}
