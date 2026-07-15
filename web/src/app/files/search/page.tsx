import FileSearchPageClient, {
  type FileSearchInitial,
} from '@/modules/files/components/search/file-search-page-client'
import { getFileSearchPageData } from '@/modules/files/search/page-data'
import type { DocSearchMode } from '@/modules/files/types'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string {
  const v = sp[key]
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v[0] ?? ''
  return ''
}

function parseMode(value: string): DocSearchMode {
  if (value === 'keyword' || value === 'semantic' || value === 'metadata') {
    return value
  }
  return 'hybrid'
}

function parsePage(value: string): number {
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export default async function FileSearchPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const { departmentOptions } = await getFileSearchPageData()

  const initialFilters: FileSearchInitial = {
    q: firstParam(sp, 'q'),
    mode: parseMode(firstParam(sp, 'mode')),
    projectName: firstParam(sp, 'project_name'),
    departmentId: firstParam(sp, 'department_id'),
    fileType: firstParam(sp, 'file_type'),
    fileExt: firstParam(sp, 'file_ext'),
    page: parsePage(firstParam(sp, 'page')),
  }

  return (
    <FileSearchPageClient
      departmentOptions={departmentOptions}
      initialFilters={initialFilters}
    />
  )
}
