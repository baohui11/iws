import { notFound } from 'next/navigation'

import WeeklyFileUploadPageClient from '@/components/weekly/weekly-file-upload-page-client'
import SubpageHeader from '@/components/common/subpage-header'
import { getSessionProfile } from '@/lib/db/auth/profile'
import { listMemberActiveProjectsForUpload } from '@/lib/db/weekly/file-upload'
import { formatMaxProjectFileLabel } from '@/lib/storage/project-file-constants'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function WeeklyProjectFileUploadPage({
  searchParams,
}: PageProps) {
  let profile
  try {
    profile = await getSessionProfile()
  } catch {
    notFound()
  }

  const sp = await searchParams
  const projectId =
    typeof sp.projectId === 'string' ? sp.projectId : undefined
  const returnTo =
    typeof sp.returnTo === 'string' ? sp.returnTo : undefined

  const projects = await listMemberActiveProjectsForUpload(profile.id)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-6 sm:px-6">
      <SubpageHeader showBack title="上传项目文件" />
      <div className="mt-1 rounded-2xl border border-default-200/60 bg-content1/80 p-4 shadow-sm sm:p-6">
        <WeeklyFileUploadPageClient
          initialProjects={projects}
          maxFileLabel={formatMaxProjectFileLabel()}
          initialProjectId={projectId}
          returnToHref={returnTo}
        />
      </div>
    </div>
  )
}

