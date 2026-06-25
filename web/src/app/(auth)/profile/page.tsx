import { redirect } from 'next/navigation'
import ProfileSettings from '@/modules/org/components/profile/settings'
import { getCurrentUser } from '@/core/auth'
import { getDepartmentTree } from '@/modules/org/departments/repo'
import {
  flattenDepartmentTree,
  formatDepartmentPathLabel,
} from '@/modules/org/departments/display'

export default async function ProfilePage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login')

  const trees = await getDepartmentTree()
  const flat = flattenDepartmentTree(trees)
  const departmentLabel = formatDepartmentPathLabel(
    profile.departmentId,
    flat,
    profile.departmentName
  )

  return (
    <ProfileSettings profile={{ ...profile, departmentName: departmentLabel }} />
  )
}
