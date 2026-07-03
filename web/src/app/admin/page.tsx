import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/core/auth'

export default async function AdminIndexPage() {
  const user = await getCurrentUser()
  redirect(user?.role === 'admin' ? '/admin/departments' : '/admin/users')
}
