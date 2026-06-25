import FileSearchPageClient, {
  type FileSearchInitial,
} from '@/modules/files/components/search/file-search-page-client'
import { getFileSearchPageData } from '@/modules/files/search/page-data'

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

export default async function FileSearchPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const { departmentOptions, projectOptions } = await getFileSearchPageData()

  const initialFilters: FileSearchInitial = {
    q: firstParam(sp, 'q'),
    projectId: firstParam(sp, 'project_id'),
    departmentId: firstParam(sp, 'department_id'),
    fileType: firstParam(sp, 'file_type'),
    fileExt: firstParam(sp, 'file_ext'),
  }

  return (
    <FileSearchPageClient
      departmentOptions={departmentOptions}
      projectOptions={projectOptions}
      initialFilters={initialFilters}
    />
  )
}
