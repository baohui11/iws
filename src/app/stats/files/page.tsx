import FilesStatsClient from '@/components/stats/files-stats-client'
import {
  getDepartmentIdsForListFilter,
  getDepartmentTree,
} from '@/lib/db/admin/departments'
import { getSessionProfile } from '@/lib/db/auth/profile'
import { formatDepartmentOptionsForStats } from '@/lib/db/stats/files-stats'

export default async function FilesStatsPage() {
  const profile = await getSessionProfile()
  const tree = await getDepartmentTree()

  let allowedIds: string[] | null = null
  if (profile.role !== 'admin' && profile.department_id) {
    allowedIds = await getDepartmentIdsForListFilter(profile.department_id)
  }

  const departmentOptions = formatDepartmentOptionsForStats(tree, allowedIds)

  const initialDepartmentId =
    profile.role === 'admin'
      ? 'all'
      : profile.department_id && allowedIds?.includes(profile.department_id)
        ? profile.department_id
        : (departmentOptions[0]?.id ?? '')

  return (
    <FilesStatsClient
      departmentOptions={departmentOptions}
      initialDepartmentId={initialDepartmentId}
      isAdmin={profile.role === 'admin'}
    />
  )
}
