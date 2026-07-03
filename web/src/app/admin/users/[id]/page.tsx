import { notFound } from 'next/navigation'
import { getUserForAdmin } from '@/modules/org/users/service'
import UserAdminSettingsForm from '@/modules/org/components/users/user-admin-settings-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params
  const user = await getUserForAdmin(id).catch(() => null)
  if (!user) notFound()

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">用户详情</h1>
        <p className="text-foreground/50 mt-1 text-sm">
          查看 OA 同步信息，维护系统角色、标签与生效状态
        </p>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <UserAdminSettingsForm user={user} />
      </div>
    </div>
  )
}
