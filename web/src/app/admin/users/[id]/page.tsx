import { notFound } from 'next/navigation'
import PageShell from '@/components/common/page-shell'
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
    <PageShell width="md">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">用户详情</h1>
      </div>

      <div className="rounded-large border-divider bg-content1 shadow-small border p-6">
        <UserAdminSettingsForm user={user} />
      </div>
    </PageShell>
  )
}
