import { getDepartmentTree } from '@/lib/db/admin/departments'
import CreateUserForm from '@/components/admin/users/create-user-form'

export default async function AdminUsersPage() {
  const departments = await getDepartmentTree()

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">添加用户</h1>
        <p className="mt-1 text-sm text-foreground/50">
          创建新用户账号，系统将自动向其企业邮箱发送邀请邮件
        </p>
      </div>

      <div className="rounded-large border border-divider bg-content1 p-6 shadow-small">
        <CreateUserForm departments={departments} />
      </div>
    </div>
  )
}
