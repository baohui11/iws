import PageShell from '@/components/common/page-shell'
import SubpageHeader from '@/components/common/subpage-header'
import WeeklyFileUploadPageClient from '@/modules/files/components/upload/weekly-file-upload-page-client'
import { requireUser } from '@/core/auth'
import { formatMaxProjectFileLabel } from '@/core/storage/constants'
import { listMemberActiveProjectsForUpload } from '@/modules/files/upload/repo'
import { parseProjectStage } from '@/constants/project-stage'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function WeeklyProjectFileUploadPage({
  searchParams,
}: PageProps) {
  const user = await requireUser()
  const sp = await searchParams
  const projectId =
    typeof sp.projectId === 'string' ? sp.projectId : undefined
  const projectStage =
    typeof sp.projectStage === 'string' ? parseProjectStage(sp.projectStage) : null
  const returnTo =
    typeof sp.returnTo === 'string' ? sp.returnTo : undefined
  const linkTargetKey =
    typeof sp.linkTargetKey === 'string' ? sp.linkTargetKey : undefined

  const projects = await listMemberActiveProjectsForUpload(user.id)

  return (
    <PageShell width="lg">
      <SubpageHeader showBack title="上传项目文件" />
      <div className="mt-1 rounded-2xl border border-default-200/60 bg-content1/80 p-4 shadow-sm sm:p-6">
        <WeeklyFileUploadPageClient
          initialProjects={projects}
          maxFileLabel={formatMaxProjectFileLabel()}
          initialProjectId={projectId}
          initialProjectStage={projectStage ?? undefined}
          returnToHref={returnTo}
          linkTargetKey={linkTargetKey}
        />
      </div>
    </PageShell>
  )
}
