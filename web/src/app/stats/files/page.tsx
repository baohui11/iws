import FilesStatsClient from '@/modules/stats/components/files/files-stats-client'
import { getFilesStatsPageData } from '@/modules/stats/service'

export default async function FilesStatsPage() {
  const { departmentOptions, initialDepartmentId, isAdmin } =
    await getFilesStatsPageData()

  return (
    <FilesStatsClient
      departmentOptions={departmentOptions}
      initialDepartmentId={initialDepartmentId}
      isAdmin={isAdmin}
    />
  )
}
