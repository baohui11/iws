import { getDepartmentTree } from '@/modules/org/departments/repo'
import CreateUserForm from '@/modules/org/components/users/create-user-form'

export default async function AdminUsersNewPage() {
  const departments = await getDepartmentTree()

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">添加用户</h1>
        <p className="text-foreground/50 mt-1 text-sm">创建用户档案</p>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <CreateUserForm departments={departments} />
      </div>
    </div>
  )
}
