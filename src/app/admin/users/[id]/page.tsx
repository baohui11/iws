import { notFound } from 'next/navigation'
import { getUserById } from '@/lib/db/admin/user'
import { getDepartmentTree } from '@/lib/db/admin/departments'
import EditUserForm from '@/components/admin/users/edit-user-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminUserEditPage({ params }: PageProps) {
  const { id } = await params
  const [user, departments] = await Promise.all([getUserById(id), getDepartmentTree()])

  if (!user) notFound()

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">编辑用户</h1>
      </div>

      <div className="rounded-large border border-divider bg-content1 p-6 shadow-small">
        <EditUserForm user={user} departments={departments} />
      </div>
    </div>
  )
}
