import { Suspense } from 'react'
import Link from 'next/link'

import PageShell from '@/components/common/page-shell'
import SubpageHeader from '@/components/common/subpage-header'
import { parseProjectStage } from '@/constants/project-stage'
import { requireUser } from '@/core/auth'
import FilesMineClient from '@/modules/files/components/mine/files-mine-client'
import {
  getMyUploadedFilesPage,
  listMyUploadedFileProjects,
} from '@/modules/files/mine/repo'
import { MINE_FILES_PAGE_SIZE } from '@/modules/files/types'

type PageProps = {
  searchParams: Promise<{
    q?: string
    projectId?: string
    stage?: string
  }>
}

export default async function WeeklyFilesPage({ searchParams }: PageProps) {
  const user = await requireUser()
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const projectId = typeof sp.projectId === 'string' ? sp.projectId.trim() : ''
  const stage = typeof sp.stage === 'string' ? sp.stage.trim() : ''
  const parsedStage = parseProjectStage(stage)

  const [page, projectOptions] = await Promise.all([
    getMyUploadedFilesPage({
      userId: user.id,
      offset: 0,
      limit: MINE_FILES_PAGE_SIZE,
      fileNameQuery: q || null,
      projectId: projectId || null,
      projectStage: parsedStage,
    }),
    listMyUploadedFileProjects(user.id),
  ])

  return (
    <PageShell>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SubpageHeader title="我的文件" className="mb-0" />
        <Link
          href="/weekly/files/upload"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-medium bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <span aria-hidden className="text-base leading-none">
            +
          </span>
          新增文件
        </Link>
      </div>

      <div className="rounded-2xl border border-default-200/80 bg-content1 p-5 shadow-sm md:p-6">
        <Suspense
          fallback={
            <div className="rounded-lg border border-dashed border-default-300 py-16 text-center text-sm text-default-500">
              加载中...
            </div>
          }
        >
          <FilesMineClient
            key={`${q}-${projectId}-${parsedStage ?? ''}`}
            initialSearch={q}
            initialProjectId={projectId}
            initialProjectStage={parsedStage ?? ''}
            projectOptions={projectOptions}
            initialRows={page.rows}
            initialHasMore={page.hasMore}
          />
        </Suspense>
      </div>
    </PageShell>
  )
}
