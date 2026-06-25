import { notFound } from 'next/navigation'
import { getUserById } from '@/modules/org/users/repo'
import { getDepartmentTree } from '@/modules/org/departments/repo'
import EditUserForm from '@/modules/org/components/users/edit-user-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminUserEditPage({ params }: PageProps) {
  const { id } = await params
  const [user, departments] = await Promise.all([
    getUserById(id),
    getDepartmentTree(),
  ])

  if (!user) notFound()

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">编辑用户</h1>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <EditUserForm key={user.id} user={user} departments={departments} />
      </div>
    </div>
  )
}
