import { Suspense } from 'react'

import { requireUser } from '@/core/auth'
import { getMyFilesMinePage } from '@/modules/files/mine/repo'
import FilesMineClient from '@/modules/files/components/mine/files-mine-client'
import type { FilesMineTab } from '@/modules/files/types'
import { MINE_FILES_PAGE_SIZE } from '@/modules/files/types'

type PageProps = {
  searchParams: Promise<{ tab?: string; q?: string }>
}

function parseTab(raw: string | undefined): FilesMineTab {
  if (raw === 'favorites') return 'favorites'
  if (raw === 'recommends') return 'recommends'
  return 'uploads'
}

export default async function FilesMinePage({ searchParams }: PageProps) {
  const user = await requireUser()
  const sp = await searchParams
  const tab = parseTab(typeof sp.tab === 'string' ? sp.tab : undefined)
  const qRaw = typeof sp.q === 'string' ? sp.q.trim() : ''
  const fileNameQuery = qRaw.length > 0 ? qRaw : null
  const { rows, hasMore } = await getMyFilesMinePage(
    user.id,
    tab,
    0,
    MINE_FILES_PAGE_SIZE,
    fileNameQuery
  )

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Suspense
        fallback={
          <div className="rounded-lg border border-dashed border-default-300 py-16 text-center text-sm text-default-500">
            加载中…
          </div>
        }
      >
        <FilesMineClient
          key={`${tab}-${fileNameQuery ?? ''}`}
          tab={tab}
          initialSearch={qRaw}
          initialRows={rows}
          initialHasMore={hasMore}
        />
      </Suspense>
    </div>
  )
}
